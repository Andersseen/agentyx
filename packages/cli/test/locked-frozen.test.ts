import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { doctorExitCode, renderDoctorReport, runDoctorCommand } from "../src/commands/doctor.js";
import { type InstallCommandInput, runInstallCommand } from "../src/commands/install.js";
import { runSyncCommand } from "../src/commands/sync.js";
import { cliVersion } from "../src/version.js";

const V1_FIXTURE = fileURLToPath(new URL("./fixtures/lock-v1", import.meta.url));
const LOCK = ".agentyx.lock.json";
const SKILL = ".agents/skills/code-quality/SKILL.md";
const AGENT = ".claude/agents/agentyx-planner.md";

const base: Omit<InstallCommandInput, "cwd"> = {
  packs: [],
  enable: [],
  targets: [],
  skills: [],
  mcpServers: [],
  select: false,
  dryRun: false,
  json: false,
};
const full = {
  packs: ["technical", "efficiency", "agentic"],
  enable: ["agentyx-planner", "codebase-memory"],
  targets: ["codex", "claude"],
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentyx-frozen-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const config = (value: Record<string, unknown>) =>
  writeFile(join(dir, ".agentyx.json"), JSON.stringify(value), "utf8");
const install = (extra: Partial<InstallCommandInput> = {}) =>
  runInstallCommand({ ...base, cwd: dir, ...extra });
const frozen = (extra: Partial<InstallCommandInput> = {}) => install({ frozen: true, ...extra });
const sync = () => runSyncCommand({ cwd: dir, dryRun: false, json: false, force: false });
const lockBytes = () => readFile(join(dir, LOCK), "utf8");
const readLock = async () => JSON.parse(await lockBytes());
const writeLock = (lock: unknown) =>
  writeFile(join(dir, LOCK), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
const read = (path: string) => readFile(join(dir, path), "utf8");
const exists = (path: string) =>
  stat(join(dir, path)).then(
    () => true,
    () => false,
  );

async function tree(prefix = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(out, await tree(rel));
    else out[rel] = await read(rel);
  }
  return out;
}

async function converged(value: Record<string, unknown> = full): Promise<void> {
  await config(value);
  await sync();
}

const locked = async () => runDoctorCommand({ json: true, cwd: dir, locked: true });

describe("doctor --locked", () => {
  it("is not checked by default and normal doctor accepts every lock shape", async () => {
    await converged();
    const report = await runDoctorCommand({ json: true, cwd: dir });

    expect(report.reproducibility).toEqual({
      checked: false,
      state: "not-checked",
      differences: [],
    });
  });

  it("reports a matching complete lock and exits 0 on a converged project", async () => {
    await converged();
    const report = await locked();

    expect(report.reproducibility).toEqual({ checked: true, state: "matching", differences: [] });
    expect(doctorExitCode(report, false)).toBeUndefined();
    expect(renderDoctorReport(report, false)).toMatch(/Locked resolution\n {2}matching/);
  });

  it("keeps a matching snapshot separate from installation readiness", async () => {
    await converged();
    await rm(join(dir, SKILL));
    const report = await locked();

    expect(report.reproducibility.state).toBe("matching");
    expect(report.readiness.installation.state).toBe("not-ready");
    expect(doctorExitCode(report, false)).toBeUndefined();
    expect(doctorExitCode(report, true)).toBe(1);
  });

  it("reports a missing lock as an error without --check", async () => {
    await config(full);
    const report = await locked();

    expect(report.reproducibility.state).toBe("missing-lock");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: "error", code: "locked_manifest_missing" }),
    );
    expect(doctorExitCode(report, false)).toBe(1);
  });

  it("reports a v1 lock while normal doctor still accepts it", async () => {
    await cp(V1_FIXTURE, dir, { recursive: true });
    const report = await locked();

    expect(report.reproducibility.state).toBe("legacy-lock");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "locked_manifest_legacy" }),
    );
    expect(doctorExitCode(report, false)).toBe(1);

    const normal = await runDoctorCommand({ json: true, cwd: dir });
    expect(normal.diagnostics.map((d) => d.code)).not.toContain("locked_manifest_legacy");
  });

  it("reports a v2 null snapshot as unavailable, not a mismatch", async () => {
    await config(full);
    await install({ skills: ["code-quality"], targets: ["codex"] });
    const report = await locked();

    expect(report.reproducibility.state).toBe("snapshot-unavailable");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "locked_resolution_missing" }),
    );
    expect(doctorExitCode(report, false)).toBe(1);
  });

  it("reports a config change as a structured mismatch", async () => {
    await converged();
    await config({ ...full, packs: [...full.packs, "typescript"] });
    const report = await locked();

    expect(report.reproducibility.state).toBe("mismatch");
    expect(report.reproducibility.differences).toContainEqual({
      kind: "config",
      change: "changed",
    });
    expect(report.diagnostics.filter((d) => d.code === "locked_resolution_mismatch")).toHaveLength(
      1,
    );
    expect(doctorExitCode(report, false)).toBe(1);
    expect(renderDoctorReport(report, false)).toMatch(
      /Locked resolution\n {2}mismatch\n {2}configuration changed/,
    );
  });

  it("reports a changed selected local Skill and ignores an unselected one", async () => {
    const skillFile = async (name: string, body: string) => {
      await mkdir(join(dir, ".agentyx/skills", name), { recursive: true });
      await writeFile(
        join(dir, ".agentyx/skills", name, "SKILL.md"),
        `---\nname: ${name}\ndescription: Local ${name}.\n---\n\n${body}\n`,
        "utf8",
      );
    };
    await skillFile("team-review", "v1");
    await skillFile("team-other", "v1");
    await converged({
      packs: ["team"],
      targets: ["codex"],
      skillDirectories: [".agentyx/skills"],
      localPacks: [{ name: "team", category: "workflow", skills: ["team-review"] }],
    });

    await skillFile("team-other", "v2");
    expect((await locked()).reproducibility.state).toBe("matching");

    await skillFile("team-review", "v2");
    const report = await locked();
    expect(report.reproducibility.differences).toEqual([
      { kind: "skill", name: "team-review", change: "changed" },
    ]);
  });

  it("enforces the exact Agentyx version", async () => {
    await converged();
    const lock = await readLock();
    lock.resolution.agentyxVersion = "0.0.1";
    await writeLock(lock);
    const report = await locked();

    expect(report.reproducibility.state).toBe("mismatch");
    expect(report.reproducibility.differences).toEqual([
      { kind: "agentyx-version", change: "changed" },
    ]);
    expect(cliVersion).not.toBe("0.0.1");
    expect(renderDoctorReport(report, false)).toContain("Agentyx version changed");
  });

  it("is unavailable, and still an error, when the current config is invalid", async () => {
    await converged();
    await writeFile(join(dir, ".agentyx.json"), "{ nope", "utf8");
    const report = await locked();

    expect(report.reproducibility.state).toBe("unavailable");
    expect(doctorExitCode(report, false)).toBe(1);
    expect(report.diagnostics.filter((d) => d.level === "error")).toHaveLength(1);
  });

  it("is an error when the config is missing entirely", async () => {
    await converged();
    await rm(join(dir, ".agentyx.json"));
    const report = await locked();

    expect(report.reproducibility.state).toBe("unavailable");
    expect(doctorExitCode(report, false)).toBe(1);
  });

  it("is read-only and prints no hashes", async () => {
    await converged();
    await config({ ...full, packs: [...full.packs, "typescript"] });
    const before = await tree();
    const report = await locked();

    expect(await tree()).toEqual(before);
    expect(JSON.stringify(report.reproducibility)).not.toMatch(/sha256|[0-9a-f]{40}/);
    expect(renderDoctorReport(report, false)).not.toMatch(/sha256/);
  });

  it("rejects --hook with --locked", async () => {
    const { createDoctorCommand } = await import("../src/commands/doctor.js");
    const previous = process.exitCode;
    const written: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      await createDoctorCommand().parseAsync(["node", "doctor", "--hook", "--locked"]);
    } finally {
      process.stderr.write = original;
    }

    expect(process.exitCode).toBe(1);
    expect(written.join("")).toMatch(/cannot be combined with --locked/);
    process.exitCode = previous;
  });
});

describe("install --frozen flag contract", () => {
  const incompatible: Array<[string, Partial<InstallCommandInput>]> = [
    ["packs", { packs: ["technical"] }],
    ["--target", { targets: ["codex"] }],
    ["--enable", { enable: ["rtk"] }],
    ["--skill", { skills: ["code-quality"] }],
    ["--mcp", { mcpServers: ["context7"] }],
    ["--select", { select: true }],
    ["--skills-only", { skillsOnly: true }],
    ["--mcp-only", { mcpOnly: true }],
    ["--force", { force: true }],
    ["--prune", { prune: true }],
    ["--migrate-lock", { migrateLock: true }],
    ["removed targets", { pruneRemovedTargets: true }],
  ];

  it.each(incompatible)("rejects %s before prompting or writing", async (_name, extra) => {
    await converged();
    await rm(join(dir, SKILL));
    const before = await tree();

    await expect(frozen(extra)).rejects.toMatchObject({ code: "frozen_mode_conflict" });
    expect(await tree()).toEqual(before);
  });
});

describe("install --frozen", () => {
  it("is a no-op on a converged project and never touches the lock", async () => {
    await converged();
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(join(dir, LOCK), old, old);
    const before = await tree();

    const output = await frozen();

    expect(output).toBe("Frozen: locked resolution matches; installation already satisfied.");
    expect(await tree()).toEqual(before);
    expect((await stat(join(dir, LOCK))).mtime.getTime()).toBe(old.getTime());
  });

  it("does not require formatting-identical locks: a reformatted lock stays byte-identical", async () => {
    await converged();
    await writeFile(join(dir, LOCK), JSON.stringify(await readLock()), "utf8");
    const bytes = await lockBytes();

    await rm(join(dir, SKILL));
    await frozen();

    expect(await lockBytes()).toBe(bytes);
    expect(await exists(SKILL)).toBe(true);
  });

  it("restores a missing owned Skill with exact canonical bytes and leaves the lock alone", async () => {
    await converged();
    const canonical = await read(SKILL);
    const bytes = await lockBytes();
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(join(dir, LOCK), old, old);
    await rm(join(dir, SKILL));

    const output = await frozen();

    expect(output).toMatch(/^Frozen: restored 1 missing managed Skill/);
    expect(await read(SKILL)).toBe(canonical);
    expect(await lockBytes()).toBe(bytes);
    expect((await stat(join(dir, LOCK))).mtime.getTime()).toBe(old.getTime());

    const after = await runDoctorCommand({ json: true, cwd: dir, locked: true });
    expect(after.reproducibility.state).toBe("matching");
    expect(after.readiness.installation.state).toBe("ready");
    expect(doctorExitCode(after, false)).toBeUndefined();
  });

  it("reports a structured JSON restore, and a dry run writes nothing", async () => {
    await converged();
    await rm(join(dir, SKILL));
    const before = await tree();

    const dry = await frozen({ dryRun: true });
    expect(dry).toMatch(
      /^Frozen dry run: 1 missing managed Skill can be restored\. Nothing was written\./,
    );
    expect(await tree()).toEqual(before);

    const report = JSON.parse(await frozen({ dryRun: true, json: true }));
    expect(report.frozen).toEqual({
      requested: true,
      snapshot: "matching",
      restorableSkills: [SKILL],
      lockChanged: false,
    });
    expect(await tree()).toEqual(before);
  });

  it("omits the frozen report for normal installs", async () => {
    await converged();
    expect(JSON.parse(await install({ json: true })).frozen).toBeUndefined();
  });

  describe("refuses before writing", () => {
    async function expectRefused(code: string, mutate: () => Promise<void>, keep = true) {
      await converged();
      const bytes = await lockBytes();
      await mutate();
      const before = await tree();

      await expect(frozen()).rejects.toMatchObject({ code });
      await expect(frozen({ dryRun: true })).rejects.toMatchObject({ code });
      expect(await tree()).toEqual(before);
      if (keep) expect(await lockBytes()).toBe(bytes);
    }

    it("without a lock", async () => {
      await config(full);
      const before = await tree();
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_lock_missing" });
      expect(await tree()).toEqual(before);
    });

    it("on a v1 lock", async () => {
      await cp(V1_FIXTURE, dir, { recursive: true });
      const before = await tree();
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_lock_legacy" });
      expect(await tree()).toEqual(before);
    });

    it("on a null snapshot", async () => {
      await config(full);
      await install({ skills: ["code-quality"], targets: ["codex"] });
      const before = await tree();
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_resolution_missing" });
      expect(await tree()).toEqual(before);
    });

    it("when the config changed, with structured differences and no hashes", async () => {
      await converged();
      await config({ ...full, packs: [...full.packs, "typescript"] });
      await rm(join(dir, SKILL));
      const before = await tree();

      const error = await frozen().catch((e) => e);
      expect(error).toMatchObject({ code: "frozen_resolution_mismatch" });
      expect(error.differences).toContainEqual({ kind: "config", change: "changed" });
      expect(error.message).toContain("configuration changed");
      expect(error.message).not.toMatch(/sha256/);
      expect(await tree()).toEqual(before);
    });

    it("when the CLI version differs", async () => {
      await converged();
      const lock = await readLock();
      lock.resolution.agentyxVersion = "0.0.1";
      await writeLock(lock);
      await rm(join(dir, SKILL));
      const before = await tree();

      const error = await frozen().catch((e) => e);
      expect(error.code).toBe("frozen_resolution_mismatch");
      expect(error.differences).toEqual([{ kind: "agentyx-version", change: "changed" }]);
      expect(await tree()).toEqual(before);
    });

    it("when a selected local Skill changed", async () => {
      const skillFile = async (body: string) => {
        await mkdir(join(dir, ".agentyx/skills/team-review"), { recursive: true });
        await writeFile(
          join(dir, ".agentyx/skills/team-review/SKILL.md"),
          `---\nname: team-review\ndescription: Review.\n---\n\n${body}\n`,
          "utf8",
        );
      };
      await skillFile("v1");
      await converged({
        packs: ["team"],
        targets: ["codex"],
        skillDirectories: [".agentyx/skills"],
        localPacks: [{ name: "team", category: "workflow", skills: ["team-review"] }],
      });
      await skillFile("v2");
      await rm(join(dir, ".agents/skills/team-review/SKILL.md"));
      const before = await tree();
      const bytes = await lockBytes();

      const error = await frozen().catch((e) => e);
      expect(error.code).toBe("frozen_resolution_mismatch");
      expect(error.differences).toEqual([
        { kind: "skill", name: "team-review", change: "changed" },
      ]);
      expect(await tree()).toEqual(before);
      expect(await lockBytes()).toBe(bytes);
    });

    it("on stale capability ownership kept by a non-pruning install", async () => {
      await converged({ ...full, packs: [...full.packs, "typescript"] });
      await config(full);
      await install();
      expect((await locked()).reproducibility.state).toBe("matching");
      const before = await tree();
      const bytes = await lockBytes();

      const error = await frozen().catch((e) => e);
      expect(error.code).toBe("frozen_stale_ownership");
      expect(error.paths.length).toBeGreaterThan(0);
      expect(await tree()).toEqual(before);
      expect(await lockBytes()).toBe(bytes);
    });

    it("on ownership of a stale entry whose file is already gone", async () => {
      await converged();
      const lock = await readLock();
      lock.entries.push({
        kind: "skill",
        path: ".agents/skills/gone/SKILL.md",
        skill: "gone",
        targets: ["codex"],
        hash: lock.entries.find((e: { kind: string }) => e.kind === "skill").hash,
      });
      await writeLock(lock);
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_stale_ownership" });
    });

    it("on ownership of a removed target", async () => {
      await converged();
      await config({ ...full, targets: ["codex"] });
      await install();
      expect((await locked()).reproducibility.state).toBe("matching");
      const error = await frozen().catch((e) => e);

      expect(error.code).toBe("frozen_stale_ownership");
      expect(error.paths.some((path: string) => path.startsWith(".claude/"))).toBe(true);
    });

    it("on an edited managed Skill, preserving the edit", async () => {
      await expectRefused("frozen_installation_change_required", () =>
        writeFile(join(dir, SKILL), "my edit\n", "utf8"),
      );
      expect(await read(SKILL)).toBe("my edit\n");
    });

    it("on a desired Skill the lock does not own, missing or present", async () => {
      await converged();
      const lock = await readLock();
      lock.entries = lock.entries.filter((e: { path: string }) => e.path !== SKILL);
      await writeLock(lock);
      const present = await tree();
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_restore_not_owned" });
      expect(await tree()).toEqual(present);

      // Missing and unowned: the lock names no owner, so frozen must not create it.
      await rm(join(dir, SKILL));
      await expect(frozen()).rejects.toMatchObject({ code: "frozen_restore_not_owned" });
      expect(await exists(SKILL)).toBe(false);
      expect(present[SKILL]).toBeDefined();
    });

    it("on a recorded Skill hash that no longer matches the canonical content", async () => {
      await converged();
      const lock = await readLock();
      const entry = lock.entries.find((e: { path: string }) => e.path === SKILL);
      entry.hash = lock.entries.find(
        (e: { kind: string; path: string }) => e.kind === "skill" && e.path !== SKILL,
      ).hash;
      await writeLock(lock);
      await rm(join(dir, SKILL));

      await expect(frozen()).rejects.toMatchObject({ code: "frozen_restore_not_owned" });
      expect(await exists(SKILL)).toBe(false);
    });

    it("on a missing Agent file", async () => {
      await expectRefused("frozen_installation_change_required", () => rm(join(dir, AGENT)));
      expect(await exists(AGENT)).toBe(false);
    });

    it("on a changed Agent file", async () => {
      await expectRefused("frozen_installation_change_required", () =>
        writeFile(join(dir, AGENT), "edited\n", "utf8"),
      );
    });

    it("on missing MCP provider config", async () => {
      await expectRefused("frozen_installation_change_required", () => rm(join(dir, ".mcp.json")));
      expect(await exists(".mcp.json")).toBe(false);
    });

    it("on a user edit to shared MCP config, keeping the edit and the lock", async () => {
      await expectRefused("frozen_installation_change_required", async () => {
        const current = JSON.parse(await read(".mcp.json"));
        current.mcpServers.mine = { command: "mine" };
        await writeFile(join(dir, ".mcp.json"), JSON.stringify(current, null, 2), "utf8");
      });
      expect(await read(".mcp.json")).toContain('"mine"');
    });

    it("on changed Hook config", async () => {
      await expectRefused("frozen_installation_change_required", async () => {
        const current = JSON.parse(await read(".codex/hooks.json"));
        current.userKey = true;
        await writeFile(join(dir, ".codex/hooks.json"), JSON.stringify(current, null, 2), "utf8");
      });
    });
  });

  it("never deletes or updates while restoring", async () => {
    await converged();
    await writeFile(join(dir, "user-note.md"), "mine\n", "utf8");
    await rm(join(dir, SKILL));
    const before = await tree();

    await frozen();
    const after = await tree();

    expect(Object.keys(after).sort()).toEqual(Object.keys(before).concat(SKILL).sort());
    for (const [path, content] of Object.entries(before)) expect(after[path]).toBe(content);
  });

  it("makes no network or process calls", async () => {
    for (const file of ["../src/snapshot.ts", "../../adapters/src/frozen.ts"]) {
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/child_process|\bfetch\(|node:http|node:net|spawn|exec\(/);
    }
  });
});
