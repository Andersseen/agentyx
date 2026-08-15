import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InstallConflictError,
  MissingInstallTargetsError,
  UnknownAdapterError,
} from "@agentyx/adapters";
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
    expect(output).toContain(
      "Dry run: 4 to create, 0 to update, 0 to remove, 0 unchanged, 0 blocked.",
    );
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
      summary: { create: 8, update: 0, unchanged: 0, conflict: 0, delete: 0 },
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

    expect(first).toContain("Installed: 4 written, 0 removed, 0 unchanged.");
    expect(second).toContain("Installed: 0 written, 0 removed, 4 unchanged.");
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
      "--force",
      "--json",
      "--mcp",
      "--mcp-only",
      "--prune",
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

describe("agentyx install ownership", () => {
  it("refuses to overwrite a skill file it did not write", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await mkdir(join(projectDir, ".agents", "skills", "code-quality"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"),
      "---\nname: code-quality\ndescription: Mine.\n---\n\nMine.\n",
      "utf8",
    );

    await expect(runInstallCommand({ ...baseInput, cwd: projectDir })).rejects.toThrow(
      InstallConflictError,
    );
    expect(
      await readFile(join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"), "utf8"),
    ).toContain("Mine.");
    expect((await readdir(projectDir)).sort()).toEqual([".agents", ".agentyx.json"]);
  });

  it("reports the conflict in a dry run without failing", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await mkdir(join(projectDir, ".agents", "skills", "code-quality"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"),
      "mine\n",
      "utf8",
    );

    const output = await runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir });

    expect(output).toContain("Conflicts");
    expect(output).toContain("  .agents/skills/code-quality/SKILL.md");
    expect(output).toContain("1 blocked");
  });

  it("overwrites the conflict when forced", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await mkdir(join(projectDir, ".agents", "skills", "code-quality"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"),
      "mine\n",
      "utf8",
    );

    await runInstallCommand({ ...baseInput, force: true, cwd: projectDir });

    expect(
      await readFile(join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"), "utf8"),
    ).toContain("name: code-quality");
  });

  it("records what it installed in .agentyx.lock.json", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    await runInstallCommand({ ...baseInput, cwd: projectDir });

    const manifest = JSON.parse(await readFile(join(projectDir, ".agentyx.lock.json"), "utf8")) as {
      entries: { path: string; targets: string[] }[];
    };

    expect(manifest.entries).toHaveLength(4);
    expect(manifest.entries[0]?.targets).toEqual(["codex"]);
  });
});

describe("agentyx install --prune", () => {
  it("removes the skills a narrowed selection no longer resolves", async () => {
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });
    await runInstallCommand({ ...baseInput, cwd: projectDir });

    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    const output = await runInstallCommand({ ...baseInput, prune: true, cwd: projectDir });

    expect(output).toContain("delete    .agents/skills/typescript-strict/SKILL.md");
    expect((await readdir(join(projectDir, ".agents", "skills"))).sort()).toEqual([
      "api-design",
      "code-quality",
      "code-review",
      "engineering-principles",
    ]);
  });

  it("leaves skills alone without --prune", async () => {
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });
    await runInstallCommand({ ...baseInput, cwd: projectDir });

    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(await readdir(join(projectDir, ".agents", "skills"))).toContain("typescript-strict");
  });

  it("never removes a skill the user wrote themselves", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...baseInput, cwd: projectDir });
    await mkdir(join(projectDir, ".agents", "skills", "my-own"), { recursive: true });
    await writeFile(join(projectDir, ".agents", "skills", "my-own", "SKILL.md"), "mine\n", "utf8");

    await writeConfig({ packs: [], targets: ["codex"] });
    await runInstallCommand({ ...baseInput, prune: true, cwd: projectDir });

    expect(await readdir(join(projectDir, ".agents", "skills"))).toEqual(["my-own"]);
  });
});

describe("shared .agents/skills directory", () => {
  /**
   * The failure this whole mechanism exists for: a repository keeps its own
   * development skill in `.agents/skills`, and a built-in Agentyx skill happens
   * to carry the same name. Before the install manifest, installing replaced the
   * repository's file without a word.
   */
  it("never replaces a repository skill that shares a built-in name", async () => {
    const mine = [
      "---",
      "name: context-efficient-development",
      "description: How this repository is developed.",
      "---",
      "",
      "Repository-specific instructions that Agentyx must not touch.",
      "",
    ].join("\n");
    await writeConfig({ packs: ["efficiency"], targets: ["codex", "kimi"] });
    await mkdir(join(projectDir, ".agents", "skills", "context-efficient-development"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, ".agents", "skills", "context-efficient-development", "SKILL.md"),
      mine,
      "utf8",
    );

    await expect(runInstallCommand({ ...baseInput, cwd: projectDir })).rejects.toThrow(
      InstallConflictError,
    );

    expect(
      await readFile(
        join(projectDir, ".agents", "skills", "context-efficient-development", "SKILL.md"),
        "utf8",
      ),
    ).toBe(mine);
    expect(await readdir(join(projectDir, ".agents", "skills"))).toEqual([
      "context-efficient-development",
    ]);
  });

  it("names the conflicting file in the error", async () => {
    await writeConfig({ packs: ["efficiency"], targets: ["codex"] });
    await mkdir(join(projectDir, ".agents", "skills", "concise-output"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "concise-output", "SKILL.md"),
      "mine\n",
      "utf8",
    );

    await expect(runInstallCommand({ ...baseInput, cwd: projectDir })).rejects.toThrow(
      /\.agents\/skills\/concise-output\/SKILL\.md/,
    );
  });
});
