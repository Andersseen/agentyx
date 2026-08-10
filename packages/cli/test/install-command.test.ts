import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissingInstallTargetsError, UnknownAdapterError } from "@agentyx/adapters";
import { AgentyxConfigNotFoundError } from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallCommand, runInstallCommand } from "../src/commands/install.js";
import { createAgentyxProgram } from "../src/index.js";

const baseInput = {
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
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-install-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await writeFile(join(projectDir, ".agentyx.json"), JSON.stringify(config), "utf8");
}

describe("agentyx install --dry-run", () => {
  it("reports planned skill writes and touches nothing", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    const output = await runInstallCommand({
      ...baseInput,
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain("Agentyx install (dry run)");
    expect(output).toContain("create    .agents/skills/engineering-principles/SKILL.md");
    expect(output).toContain("Dry run: 4 to create, 0 to update, 0 unchanged.");
    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);
  });

  it("emits JSON without skill bodies", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex", "claude"] });

    const document = JSON.parse(
      await runInstallCommand({ ...baseInput, dryRun: true, json: true, cwd: projectDir }),
    );

    expect(document).toMatchObject({
      dryRun: true,
      packs: ["technical"],
      skills: ["engineering-principles", "code-quality", "api-design", "code-review"],
      mcpServers: [],
      tools: [],
      targets: ["codex", "claude"],
      summary: { create: 8, update: 0, unchanged: 0 },
    });
    expect(JSON.stringify(document)).not.toContain("# Engineering principles");
  });
});

describe("target selection", () => {
  it("overrides configured targets with --target", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    const output = await runInstallCommand({
      ...baseInput,
      targets: ["claude"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain("claude -> .claude/skills");
    expect(output).not.toContain("codex -> .agents/skills");
  });

  it("fails on unknown, missing, or absent targets", async () => {
    await writeConfig({ packs: ["technical"], targets: ["opencode"] });

    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(UnknownAdapterError);

    await writeConfig({ packs: ["technical"], targets: [] });
    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(MissingInstallTargetsError);

    await rm(join(projectDir, ".agentyx.json"));
    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(AgentyxConfigNotFoundError);
  });
});

describe("agentyx install <pack>", () => {
  it("installs explicit packs without reading project configuration", async () => {
    const output = await runInstallCommand({
      ...baseInput,
      packs: ["efficiency"],
      enable: ["codebase-memory"],
      targets: ["codex"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain("context-efficient-development");
    expect(output).toContain(".codex/config.toml (codebase-memory)");
  });
});

describe("agentyx install --skill/--mcp", () => {
  it("installs selected skills and MCP servers manually", async () => {
    const output = await runInstallCommand({
      ...baseInput,
      targets: ["codex"],
      skills: ["planning"],
      mcpServers: ["context7"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain(".agents/skills/planning/SKILL.md");
    expect(output).toContain(".codex/config.toml (context7)");
  });

  it("does not combine manual selections with pack arguments", async () => {
    await expect(
      runInstallCommand({
        ...baseInput,
        packs: ["technical"],
        targets: ["codex"],
        skills: ["planning"],
        dryRun: true,
        cwd: projectDir,
      }),
    ).rejects.toThrow("Manual --skill/--mcp selection cannot be combined with pack arguments.");
  });
});

describe("agentyx install", () => {
  it("installs and reports unchanged on a second run", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    const first = await runInstallCommand({ ...baseInput, cwd: projectDir });
    const second = await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(first).toContain("Installed: 4 written, 0 unchanged.");
    expect(second).toContain("Installed: 0 written, 4 unchanged.");
    expect(
      await readFile(join(projectDir, ".agents/skills/code-quality/SKILL.md"), "utf8"),
    ).toContain("# Code quality");
  });
});

describe("install command wiring", () => {
  it("declares the packs argument and install flags", () => {
    const command = createInstallCommand();

    expect(command.name()).toBe("install");
    expect(command.options.map((option) => option.long).sort()).toEqual([
      "--dry-run",
      "--enable",
      "--json",
      "--mcp",
      "--mcp-only",
      "--select",
      "--skill",
      "--skills-only",
      "--target",
    ]);
    expect(command.registeredArguments.map((argument) => argument.name())).toEqual(["packs"]);
    expect(command.registeredArguments[0]?.variadic).toBe(true);
  });

  it("is registered on the agentyx program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("install");
  });
});
