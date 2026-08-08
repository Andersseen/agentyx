import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnknownAdapterError } from "@agnox/adapters";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTargetCommand,
  runTargetListCommand,
  runTargetShowCommand,
} from "../src/commands/target.js";
import { createAgnoxProgram } from "../src/index.js";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agnox-target-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("agnox target list", () => {
  it("prints the installable target ids", () => {
    expect(runTargetListCommand()).toBe(["codex", "claude"].join("\n"));
  });
});

describe("agnox target show", () => {
  it("prints the id, the provider name and the project destination", async () => {
    expect(await runTargetShowCommand({ target: "codex", json: false, cwd: projectDir })).toBe(
      ["codex", "Codex", ".agents/skills (not present)"].join("\n"),
    );
    expect(await runTargetShowCommand({ target: "claude", json: false, cwd: projectDir })).toBe(
      ["claude", "Claude Code", ".claude/skills (not present)"].join("\n"),
    );
  });

  it("reports a destination that already exists", async () => {
    await mkdir(join(projectDir, ".agents", "skills"), { recursive: true });

    expect(await runTargetShowCommand({ target: "codex", json: false, cwd: projectDir })).toBe(
      ["codex", "Codex", ".agents/skills"].join("\n"),
    );
  });

  it("prints machine-readable metadata in --json mode", async () => {
    const output = await runTargetShowCommand({ target: "claude", json: true, cwd: projectDir });

    expect(JSON.parse(output)).toEqual({
      id: "claude",
      name: "Claude Code",
      skillsPath: ".claude/skills",
      present: false,
    });
  });

  it("exposes no adapter internals", async () => {
    const output = await runTargetShowCommand({ target: "codex", json: true, cwd: projectDir });

    expect(Object.keys(JSON.parse(output)).sort()).toEqual(["id", "name", "present", "skillsPath"]);
  });

  it("fails on an unknown target", async () => {
    await expect(
      runTargetShowCommand({ target: "opencode", json: false, cwd: projectDir }),
    ).rejects.toThrow(UnknownAdapterError);
  });
});

describe("target command wiring", () => {
  it("declares list and show", () => {
    const target = createTargetCommand();

    expect(target.name()).toBe("target");
    expect(target.commands.map((command) => command.name()).sort()).toEqual(["list", "show"]);
  });

  it("declares the target argument and the --json flag on show", () => {
    const show = createTargetCommand().commands.find((command) => command.name() === "show");

    expect(show?.registeredArguments.map((argument) => argument.name())).toEqual(["target"]);
    expect(show?.registeredArguments[0]?.required).toBe(true);
    expect(show?.options.map((option) => option.long)).toContain("--json");
  });

  it("is registered on the agnox program", () => {
    expect(createAgnoxProgram().commands.map((command) => command.name())).toContain("target");
  });
});
