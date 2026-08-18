import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSourceCommand,
  runSourceInspectCommand,
  runSourceListCommand,
  runSourceShowCommand,
} from "../src/commands/source.js";
import { createAgentyxProgram } from "../src/index.js";

describe("agentyx source list", () => {
  it("lists known trusted sources", () => {
    expect(runSourceListCommand()).toBe("superpowers    codex-plugin metadata-only");
  });
});

describe("agentyx source show", () => {
  it("shows the Superpowers source definition", () => {
    const output = runSourceShowCommand({ name: "superpowers", json: false });

    expect(output).toContain("Superpowers");
    expect(output).toContain("https://github.com/obra/superpowers");
    expect(output).toContain(".codex-plugin/plugin.json");
    expect(output).toContain('"trustedSources"');
  });

  it("prints JSON", () => {
    expect(JSON.parse(runSourceShowCommand({ name: "superpowers", json: true }))).toMatchObject({
      name: "superpowers",
      type: "codex-plugin",
      installStatus: "metadata-only",
    });
  });
});

describe("agentyx source inspect", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-cli-source-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("inspects a configured local Superpowers checkout", async () => {
    await writeSuperpowersFixture(projectDir);
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({
        trustedSources: [
          { name: "superpowers", path: ".agentyx/sources/superpowers", ref: "v5.1.0" },
        ],
      }),
      "utf8",
    );

    const output = await runSourceInspectCommand({
      name: "superpowers",
      json: false,
      cwd: projectDir,
    });

    expect(output).toContain("manifest version: 5.1.0");
    expect(output).toContain("skills: 1");
    expect(output).toContain("using-superpowers    resources");
    expect(output).toContain("installable: no");
  });
});

describe("source command wiring", () => {
  it("has list, show and inspect subcommands", () => {
    expect(createSourceCommand().commands.map((command) => command.name())).toEqual([
      "list",
      "show",
      "inspect",
    ]);
  });

  it("is part of the top-level program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("source");
  });
});

async function writeSuperpowersFixture(projectDir: string): Promise<void> {
  const root = join(projectDir, ".agentyx", "sources", "superpowers");
  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, "skills", "using-superpowers"), { recursive: true });
  await writeFile(
    join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({
      name: "superpowers",
      version: "5.1.0",
      description: "Planning, TDD, debugging and delivery workflows.",
      repository: "https://github.com/obra/superpowers",
      license: "MIT",
      skills: "../skills/",
    }),
    "utf8",
  );
  await writeFile(
    join(root, "skills", "using-superpowers", "SKILL.md"),
    "---\nname: using-superpowers\ndescription: Use when starting a conversation.\n---\n\nFind and use relevant skills.\n",
    "utf8",
  );
  await writeFile(
    join(root, "skills", "using-superpowers", "codex-tools.md"),
    "Codex tool mapping.\n",
    "utf8",
  );
}
