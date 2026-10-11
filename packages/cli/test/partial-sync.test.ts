import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runConfigureCommand } from "../src/commands/configure.js";
import { runDoctorCommand } from "../src/commands/doctor.js";
import { runSyncCommand } from "../src/commands/sync.js";

/**
 * Makes the Nth `SKILL.md` write fail, the way a full disk or an I/O error would. Real writes
 * everywhere else, so the rest of the lifecycle is the production code path.
 */
const fault = vi.hoisted(() => ({ failOnSkillWrite: 0, skillWrites: 0 }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();

  return {
    ...actual,
    writeFile: (async (path: Parameters<typeof actual.writeFile>[0], ...rest: unknown[]) => {
      if (String(path).endsWith("SKILL.md") && ++fault.skillWrites === fault.failOnSkillWrite) {
        throw Object.assign(new Error(`EIO: ${String(path)}`), { code: "EIO" });
      }

      return (actual.writeFile as (...args: unknown[]) => Promise<void>)(path, ...rest);
    }) as typeof actual.writeFile,
  };
});

describe("a sync that fails after its first write", () => {
  let projectDir: string;
  const config = { packs: ["testing"], targets: ["codex"] };

  beforeEach(async () => {
    fault.failOnSkillWrite = 2;
    fault.skillWrites = 0;
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-partial-"));
    await writeFile(join(projectDir, ".agentyx.json"), `${JSON.stringify(config)}\n`, "utf8");
  });

  afterEach(async () => {
    fault.failOnSkillWrite = 0;
    await rm(projectDir, { recursive: true, force: true });
  });

  const sync = () => runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });

  it("reports an incomplete install, no success, and never commits the lock", async () => {
    const error = await sync().catch((cause) => cause);

    expect(error.code).toBe("incomplete_install");
    expect(error.message).toMatch(/partially applied/);
    expect(error.message).toMatch(/Completed:\n {2}- \.agents\/skills\//);
    expect(error.message).not.toContain(projectDir);
    expect(error.message).not.toContain("Installed:");
    await expect(readFile(join(projectDir, ".agentyx.lock.json"))).rejects.toThrow();
  });

  it("is not reported healthy by doctor, and a later sync converges", async () => {
    await sync().catch(() => undefined);

    const report = await runDoctorCommand({ cwd: projectDir, json: false });
    expect(report.diagnostics.some((item) => item.code === "installation_pending")).toBe(true);

    fault.failOnSkillWrite = 0;
    await sync();
    const converged = await runDoctorCommand({ cwd: projectDir, json: false });
    expect(converged.diagnostics.some((item) => item.code === "installation_pending")).toBe(false);
  });

  it("configure --sync keeps the desired config and keeps the partial-install code", async () => {
    const error = await runConfigureCommand({
      cwd: projectDir,
      dryRun: false,
      json: false,
      yes: true,
      sync: true,
      enable: ["playwright"],
    }).catch((cause) => cause);

    expect(error.code).toBe("incomplete_install");
    expect(error.message).toMatch(/Configuration updated[\s\S]*Sync did not finish/);
    const saved = JSON.parse(await readFile(join(projectDir, ".agentyx.json"), "utf8"));
    expect(saved.enable).toEqual(["playwright"]);
  });
});
