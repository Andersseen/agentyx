import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AgnoxConfigNotFoundError, UnknownStackError } from "@agnox/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResolveCommand, runResolveCommand } from "../src/commands/resolve.js";
import { createAgnoxProgram } from "../src/index.js";

const exampleProjectPath = fileURLToPath(new URL("../../../examples/angular", import.meta.url));

describe("agnox resolve <stack>", () => {
  it("resolves an explicit stack without a project configuration", async () => {
    const output = await runResolveCommand({
      stacks: ["angular"],
      json: false,
      cwd: tmpdir(),
    });

    expect(output).toBe(
      [
        "Stacks",
        "  core",
        "  typescript",
        "  angular",
        "",
        "Skills",
        "  planning",
        "  systematic-debugging",
        "  verification",
        "  typescript-modern",
        "  angular-modern",
        "",
        "MCP",
        "  context7",
      ].join("\n"),
    );
  });

  it("resolves core and typescript", async () => {
    const base = { json: false, cwd: tmpdir() };

    expect(await runResolveCommand({ ...base, stacks: ["core"] })).toBe(
      [
        "Stacks",
        "  core",
        "",
        "Skills",
        "  planning",
        "  systematic-debugging",
        "  verification",
        "",
        "MCP",
        "  (none)",
      ].join("\n"),
    );
    expect(await runResolveCommand({ ...base, stacks: ["typescript"] })).toContain(
      "Stacks\n  core\n  typescript\n",
    );
    expect(await runResolveCommand({ ...base, stacks: ["typescript"] })).toContain(
      "Skills\n  planning\n  systematic-debugging\n  verification\n  typescript-modern",
    );
  });

  it("resolves several explicit stacks", async () => {
    const output = await runResolveCommand({
      stacks: ["typescript", "angular"],
      json: false,
      cwd: tmpdir(),
    });

    expect(output).toContain("Stacks\n  core\n  typescript\n  angular");
  });

  it("prints JSON only in --json mode", async () => {
    const output = await runResolveCommand({
      stacks: ["angular"],
      json: true,
      cwd: tmpdir(),
    });

    expect(JSON.parse(output)).toEqual({
      requestedStacks: ["angular"],
      resolvedStacks: ["core", "typescript", "angular"],
      skills: [
        "planning",
        "systematic-debugging",
        "verification",
        "typescript-modern",
        "angular-modern",
      ],
      mcpServers: ["context7"],
    });
  });

  it("never prints skill instructions", async () => {
    const output = await runResolveCommand({ stacks: ["angular"], json: false, cwd: tmpdir() });

    expect(output).not.toContain("# Modern Angular");
    expect(output.split("\n")).toHaveLength(14);
  });

  it("fails on an unknown stack", async () => {
    await expect(
      runResolveCommand({ stacks: ["svelte"], json: false, cwd: tmpdir() }),
    ).rejects.toThrow(UnknownStackError);
  });
});

describe("agnox resolve", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "agnox-cli-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("renders the project configuration", async () => {
    await writeFile(
      join(projectPath, ".agnox.json"),
      JSON.stringify({ extends: ["angular"], profile: "balanced", targets: ["codex", "kimi"] }),
      "utf8",
    );

    const output = await runResolveCommand({ stacks: [], json: false, cwd: projectPath });

    expect(output).toBe(
      [
        "Agnox configuration",
        "",
        "Profile",
        "  balanced",
        "",
        "Targets",
        "  codex",
        "  kimi",
        "",
        "Stacks",
        "  core",
        "  typescript",
        "  angular",
        "",
        "Skills",
        "  planning",
        "  systematic-debugging",
        "  verification",
        "  typescript-modern",
        "  angular-modern",
        "",
        "MCP",
        "  context7",
      ].join("\n"),
    );
  });

  it("marks empty target lists", async () => {
    await writeFile(
      join(projectPath, ".agnox.json"),
      JSON.stringify({ extends: ["core"] }),
      "utf8",
    );

    const output = await runResolveCommand({ stacks: [], json: false, cwd: projectPath });

    expect(output).toContain("Targets\n  (none)");
  });

  it("emits the resolved configuration as JSON", async () => {
    const output = await runResolveCommand({ stacks: [], json: true, cwd: exampleProjectPath });

    expect(JSON.parse(output)).toEqual({
      requestedStacks: ["angular"],
      resolvedStacks: ["core", "typescript", "angular"],
      skills: [
        "planning",
        "systematic-debugging",
        "verification",
        "typescript-modern",
        "angular-modern",
      ],
      mcpServers: ["context7"],
      profile: "balanced",
      targets: ["codex", "claude"],
    });
  });

  it("resolves the example project for humans", async () => {
    const output = await runResolveCommand({ stacks: [], json: false, cwd: exampleProjectPath });

    expect(output).toContain("Stacks\n  core\n  typescript\n  angular");
    expect(output).toContain("Skills\n  planning\n  systematic-debugging\n  verification");
  });

  it("fails when the project has no configuration", async () => {
    await expect(runResolveCommand({ stacks: [], json: false, cwd: projectPath })).rejects.toThrow(
      AgnoxConfigNotFoundError,
    );
  });

  it("prefers an explicit stack over the project configuration", async () => {
    await writeFile(
      join(projectPath, ".agnox.json"),
      JSON.stringify({ extends: ["angular"] }),
      "utf8",
    );

    const output = await runResolveCommand({
      stacks: ["typescript"],
      json: false,
      cwd: projectPath,
    });

    expect(output).toContain("Stacks\n  core\n  typescript\n");
    expect(output).not.toContain("angular");
  });
});

describe("resolve command wiring", () => {
  it("declares the stacks argument and the --json flag", () => {
    const command = createResolveCommand();

    expect(command.name()).toBe("resolve");
    expect(command.options.map((option) => option.long)).toContain("--json");
    expect(command.registeredArguments.map((argument) => argument.name())).toEqual(["stacks"]);
    expect(command.registeredArguments[0]?.variadic).toBe(true);
  });

  it("is registered on the agnox program", () => {
    const names = createAgnoxProgram().commands.map((command) => command.name());

    expect(names).toContain("resolve");
  });
});
