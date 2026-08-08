import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MissingInstallTargetsError, UnknownAdapterError } from "@agnox/adapters";
import { AgnoxConfigNotFoundError, builtInSkillRegistry, formatSkillMarkdown } from "@agnox/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallCommand, runInstallCommand } from "../src/commands/install.js";
import { createAgnoxProgram } from "../src/index.js";

const exampleProjectPath = fileURLToPath(new URL("../../../examples/angular", import.meta.url));

const baseInput = { stacks: [], targets: [], dryRun: false, json: false };

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agnox-install-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await writeFile(join(projectDir, ".agnox.json"), JSON.stringify(config), "utf8");
}

describe("agnox install --dry-run", () => {
  it("reports the planned writes and touches nothing", async () => {
    await writeConfig({ extends: ["core"], targets: ["codex"] });

    const output = await runInstallCommand({
      ...baseInput,
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toBe(
      [
        "Agnox install (dry run)",
        "",
        "codex -> .agents/skills",
        "  create    .agents/skills/planning/SKILL.md",
        "  create    .agents/skills/systematic-debugging/SKILL.md",
        "  create    .agents/skills/verification/SKILL.md",
        "",
        "Dry run: 3 to create, 0 to update, 0 unchanged. Nothing was written.",
      ].join("\n"),
    );
    expect(await readdir(projectDir)).toEqual([".agnox.json"]);
  });

  it("plans every configured target", async () => {
    await writeConfig({ extends: ["core"], targets: ["codex", "claude"] });

    const output = await runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir });

    expect(output).toContain("codex -> .agents/skills");
    expect(output).toContain("claude -> .claude/skills");
    expect(output).toContain("Dry run: 6 to create");
  });

  it("never prints skill instructions", async () => {
    await writeConfig({ extends: ["angular"], targets: ["codex"] });

    const output = await runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir });

    expect(output).not.toContain("# Modern Angular");
  });
});

describe("agnox install --dry-run --json", () => {
  it("emits a machine-readable plan and nothing else", async () => {
    await writeConfig({ extends: ["core"], targets: ["codex", "claude"] });

    const output = await runInstallCommand({
      ...baseInput,
      dryRun: true,
      json: true,
      cwd: projectDir,
    });

    expect(JSON.parse(output)).toEqual({
      dryRun: true,
      stacks: ["core"],
      skills: ["planning", "systematic-debugging", "verification"],
      targets: ["codex", "claude"],
      plans: [
        {
          target: "codex",
          name: "Codex",
          skillsPath: ".agents/skills",
          operations: [
            {
              type: "write-file",
              status: "create",
              skill: "planning",
              path: ".agents/skills/planning/SKILL.md",
            },
            {
              type: "write-file",
              status: "create",
              skill: "systematic-debugging",
              path: ".agents/skills/systematic-debugging/SKILL.md",
            },
            {
              type: "write-file",
              status: "create",
              skill: "verification",
              path: ".agents/skills/verification/SKILL.md",
            },
          ],
        },
        {
          target: "claude",
          name: "Claude Code",
          skillsPath: ".claude/skills",
          operations: [
            {
              type: "write-file",
              status: "create",
              skill: "planning",
              path: ".claude/skills/planning/SKILL.md",
            },
            {
              type: "write-file",
              status: "create",
              skill: "systematic-debugging",
              path: ".claude/skills/systematic-debugging/SKILL.md",
            },
            {
              type: "write-file",
              status: "create",
              skill: "verification",
              path: ".claude/skills/verification/SKILL.md",
            },
          ],
        },
      ],
      summary: { create: 6, update: 0, unchanged: 0 },
    });
  });

  it("carries no absolute paths and no skill bodies", async () => {
    await writeConfig({ extends: ["angular"], targets: ["codex"] });

    const output = await runInstallCommand({
      ...baseInput,
      dryRun: true,
      json: true,
      cwd: projectDir,
    });

    expect(output).not.toContain(projectDir);
    expect(output).not.toContain("# Modern Angular");
  });
});

describe("target selection", () => {
  it("overrides the configured targets with --target", async () => {
    await writeConfig({ extends: ["core"], targets: ["codex"] });

    const output = await runInstallCommand({
      ...baseInput,
      targets: ["claude"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain("claude -> .claude/skills");
    expect(output).not.toContain("codex");
  });

  it("accepts several --target values", async () => {
    await writeConfig({ extends: ["core"], targets: [] });

    const output = await runInstallCommand({
      ...baseInput,
      targets: ["codex", "claude"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain("codex -> .agents/skills");
    expect(output).toContain("claude -> .claude/skills");
  });

  it("leaves .agnox.json untouched", async () => {
    const config = { extends: ["core"], targets: ["codex"] };
    await writeConfig(config);

    await runInstallCommand({ ...baseInput, targets: ["claude"], cwd: projectDir });

    expect(JSON.parse(await readFile(join(projectDir, ".agnox.json"), "utf8"))).toEqual(config);
  });

  it("fails on a target with no adapter", async () => {
    await writeConfig({ extends: ["core"], targets: ["kimi"] });

    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(UnknownAdapterError);
  });

  it("fails when neither the configuration nor the flags name a target", async () => {
    await writeConfig({ extends: ["core"] });

    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(MissingInstallTargetsError);
  });

  it("fails when the project has no configuration", async () => {
    await expect(
      runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(AgnoxConfigNotFoundError);
  });
});

describe("agnox install <stack>", () => {
  it("installs explicit stacks without a project configuration", async () => {
    const output = await runInstallCommand({
      ...baseInput,
      stacks: ["typescript"],
      targets: ["codex"],
      dryRun: true,
      cwd: projectDir,
    });

    expect(output).toContain(".agents/skills/typescript-modern/SKILL.md");
    expect(output).toContain("Dry run: 4 to create");
  });

  it("requires an explicit target, because the configuration is not read", async () => {
    await writeConfig({ extends: ["angular"], targets: ["codex"] });

    await expect(
      runInstallCommand({ ...baseInput, stacks: ["core"], dryRun: true, cwd: projectDir }),
    ).rejects.toThrow(MissingInstallTargetsError);
  });
});

describe("agnox install", () => {
  it("installs the example project for both providers", async () => {
    await cp(exampleProjectPath, projectDir, { recursive: true });

    const output = await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(output).toContain("Installed: 10 written, 0 unchanged.");
    expect((await readdir(join(projectDir, ".agents", "skills"))).sort()).toEqual([
      "angular-modern",
      "planning",
      "systematic-debugging",
      "typescript-modern",
      "verification",
    ]);
    expect((await readdir(join(projectDir, ".claude", "skills"))).sort()).toEqual([
      "angular-modern",
      "planning",
      "systematic-debugging",
      "typescript-modern",
      "verification",
    ]);
  });

  it("installs the canonical skill, identically for every provider", async () => {
    await cp(exampleProjectPath, projectDir, { recursive: true });

    await runInstallCommand({ ...baseInput, cwd: projectDir });

    const expected = formatSkillMarkdown(builtInSkillRegistry.get("angular-modern"));

    expect(
      await readFile(join(projectDir, ".agents", "skills", "angular-modern", "SKILL.md"), "utf8"),
    ).toBe(expected);
    expect(
      await readFile(join(projectDir, ".claude", "skills", "angular-modern", "SKILL.md"), "utf8"),
    ).toBe(expected);
  });

  it("reports everything as unchanged on a second run", async () => {
    await cp(exampleProjectPath, projectDir, { recursive: true });

    await runInstallCommand({ ...baseInput, cwd: projectDir });
    const output = await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(output).toContain("Installed: 0 written, 10 unchanged.");
    expect(output).toContain("unchanged .agents/skills/planning/SKILL.md");
  });

  it("updates a managed skill that was edited", async () => {
    await cp(exampleProjectPath, projectDir, { recursive: true });
    await runInstallCommand({ ...baseInput, cwd: projectDir });

    const path = join(projectDir, ".claude", "skills", "planning", "SKILL.md");
    await writeFile(path, "---\nname: planning\ndescription: Edited\n---\n\nEdited.\n", "utf8");

    const planned = await runInstallCommand({ ...baseInput, dryRun: true, cwd: projectDir });
    expect(planned).toContain("update    .claude/skills/planning/SKILL.md");

    const output = await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(output).toContain("Installed: 1 written, 9 unchanged.");
    expect(await readFile(path, "utf8")).toBe(
      formatSkillMarkdown(builtInSkillRegistry.get("planning")),
    );
  });

  it("leaves unrelated files alone", async () => {
    await cp(exampleProjectPath, projectDir, { recursive: true });
    await writeFile(join(projectDir, "README.md"), "mine\n", "utf8");
    await mkdir(join(projectDir, ".claude"), { recursive: true });
    await writeFile(join(projectDir, ".claude", "settings.json"), "{}\n", "utf8");

    await runInstallCommand({ ...baseInput, cwd: projectDir });

    expect(await readFile(join(projectDir, "README.md"), "utf8")).toBe("mine\n");
    expect(await readFile(join(projectDir, ".claude", "settings.json"), "utf8")).toBe("{}\n");
    expect((await readdir(projectDir)).sort()).toEqual([
      ".agents",
      ".agnox.json",
      ".claude",
      "README.md",
    ]);
  });

  it("emits JSON for an applied installation too", async () => {
    await writeConfig({ extends: ["core"], targets: ["codex"] });

    const output = await runInstallCommand({ ...baseInput, json: true, cwd: projectDir });
    const document = JSON.parse(output);

    expect(document.dryRun).toBe(false);
    expect(document.summary).toEqual({ create: 3, update: 0, unchanged: 0 });
  });
});

describe("install command wiring", () => {
  it("declares the stacks argument and the install flags", () => {
    const command = createInstallCommand();

    expect(command.name()).toBe("install");
    expect(command.options.map((option) => option.long).sort()).toEqual([
      "--dry-run",
      "--json",
      "--target",
    ]);
    expect(command.registeredArguments.map((argument) => argument.name())).toEqual(["stacks"]);
    expect(command.registeredArguments[0]?.variadic).toBe(true);
  });

  it("is registered on the agnox program", () => {
    expect(createAgnoxProgram().commands.map((command) => command.name())).toContain("install");
  });
});
