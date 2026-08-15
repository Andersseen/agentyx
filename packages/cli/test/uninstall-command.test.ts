import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstallCommand } from "../src/commands/install.js";
import {
  createUninstallCommand,
  runUninstallCommand,
  UninstallCommandError,
} from "../src/commands/uninstall.js";
import { createAgentyxProgram } from "../src/index.js";

const installInput = {
  packs: [],
  enable: [],
  targets: [],
  skills: [],
  mcpServers: [],
  select: false,
  dryRun: false,
  json: false,
};

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-uninstall-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await writeFile(join(projectDir, ".agentyx.json"), JSON.stringify(config), "utf8");
}

describe("agentyx uninstall", () => {
  it("removes everything it installed and leaves the configuration in place", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex", "claude"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    const output = await runUninstallCommand({
      targets: [],
      dryRun: false,
      json: false,
      cwd: projectDir,
    });

    expect(output).toContain("Agentyx uninstall");
    expect(output).toContain("delete    .agents/skills/code-quality/SKILL.md");
    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);
  });

  it("changes nothing on a dry run", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    const output = await runUninstallCommand({
      targets: [],
      dryRun: true,
      json: false,
      cwd: projectDir,
    });

    expect(output).toContain("Agentyx uninstall (dry run)");
    expect(output).toContain("Nothing was removed.");
    expect((await readdir(projectDir)).sort()).toEqual([
      ".agents",
      ".agentyx.json",
      ".agentyx.lock.json",
    ]);
  });

  it("keeps a managed file that was edited after installation", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    const path = join(projectDir, ".agents", "skills", "code-quality", "SKILL.md");
    await writeFile(path, "my own notes\n", "utf8");

    const output = await runUninstallCommand({
      targets: [],
      dryRun: false,
      json: false,
      cwd: projectDir,
    });

    expect(output).toContain("Kept");
    expect(await readFile(path, "utf8")).toBe("my own notes\n");
  });

  it("never removes files it did not install", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });
    await mkdir(join(projectDir, ".agents", "skills", "my-own"), { recursive: true });
    await writeFile(join(projectDir, ".agents", "skills", "my-own", "SKILL.md"), "mine\n", "utf8");

    await runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: projectDir });

    expect(await readdir(join(projectDir, ".agents", "skills"))).toEqual(["my-own"]);
  });

  it("takes back only its own MCP entries", async () => {
    await writeFile(
      join(projectDir, ".mcp.json"),
      `${JSON.stringify({ mcpServers: { mine: { type: "stdio", command: "mine", args: [] } } }, null, 2)}\n`,
      "utf8",
    );
    await writeConfig({ packs: ["angular"], targets: ["claude"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    await runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: projectDir });

    const config = JSON.parse(await readFile(join(projectDir, ".mcp.json"), "utf8"));

    expect(config.mcpServers.context7).toBeUndefined();
    expect(config.mcpServers.mine).toEqual({ type: "stdio", command: "mine", args: [] });
  });

  it("uninstalls a single target and keeps the rest recorded", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex", "claude"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    await runUninstallCommand({
      targets: ["claude"],
      dryRun: false,
      json: false,
      cwd: projectDir,
    });

    expect((await readdir(projectDir)).sort()).toEqual([
      ".agents",
      ".agentyx.json",
      ".agentyx.lock.json",
    ]);
    expect(await readdir(join(projectDir, ".agents", "skills"))).toHaveLength(4);
  });

  it("fails when the project has no recorded installation", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    await expect(
      runUninstallCommand({ targets: [], dryRun: false, json: false, cwd: projectDir }),
    ).rejects.toThrow(UninstallCommandError);
  });

  it("fails when a named target was never installed", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    await expect(
      runUninstallCommand({ targets: ["claude"], dryRun: false, json: false, cwd: projectDir }),
    ).rejects.toThrow(UninstallCommandError);
  });

  it("emits machine-readable JSON", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    const document = JSON.parse(
      await runUninstallCommand({ targets: [], dryRun: true, json: true, cwd: projectDir }),
    );

    expect(document).toMatchObject({ dryRun: true, targets: ["codex"], kept: [] });
    expect(document.summary.delete).toBe(4);
  });
});

describe("uninstall command wiring", () => {
  it("declares its flags", () => {
    const command = createUninstallCommand();

    expect(command.name()).toBe("uninstall");
    expect(command.options.map((option) => option.long).sort()).toEqual([
      "--dry-run",
      "--json",
      "--target",
    ]);
  });

  it("is registered on the agentyx program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("uninstall");
  });
});
