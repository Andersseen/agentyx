import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgentyxConfigNotFoundError,
  UnknownEnabledCapabilityError,
  UnknownPackError,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createResolveCommand, runResolveCommand } from "../src/commands/resolve.js";
import { createAgentyxProgram } from "../src/index.js";

const exampleProjectPath = fileURLToPath(new URL("../../../examples/angular", import.meta.url));

describe("agentyx resolve <pack>", () => {
  it("resolves an explicit pack without hidden inheritance", async () => {
    const output = await runResolveCommand({
      packs: ["angular"],
      json: false,
      cwd: tmpdir(),
    });

    expect(output).toBe(
      [
        "Packs",
        "  angular",
        "",
        "Skills",
        "  angular-modern",
        "  angular-signals",
        "  angular-architecture",
        "  angular-testing",
        "",
        "MCP",
        "  context7    default",
        "",
        "Tools",
        "  (none)",
      ].join("\n"),
    );
  });

  it("composes several explicit packs in configured order", async () => {
    const output = await runResolveCommand({
      packs: ["technical", "typescript", "angular"],
      json: false,
      cwd: tmpdir(),
    });

    expect(output).toContain("Packs\n  technical\n  typescript\n  angular");
    expect(output).toContain("Skills\n  engineering-principles");
    expect(output).toContain("  typescript-strict");
    expect(output).toContain("  angular-modern");
  });

  it("keeps optional efficiency capabilities disabled unless enabled", async () => {
    const disabled = await runResolveCommand({
      packs: ["efficiency"],
      json: false,
      cwd: tmpdir(),
    });
    const enabled = await runResolveCommand({
      packs: ["efficiency"],
      enable: ["rtk", "codebase-memory"],
      json: false,
      cwd: tmpdir(),
    });

    expect(disabled).toContain("codebase-memory    disabled (optional)");
    expect(disabled).toContain("rtk    disabled (optional)");
    expect(enabled).toContain("codebase-memory    optional");
    expect(enabled).toContain("rtk    optional");
  });

  it("prints JSON only in --json mode", async () => {
    const output = await runResolveCommand({
      packs: ["efficiency"],
      enable: ["rtk"],
      json: true,
      cwd: tmpdir(),
    });

    expect(JSON.parse(output)).toMatchObject({
      requestedPacks: ["efficiency"],
      resolvedPacks: ["efficiency"],
      mcpServers: [],
      tools: ["rtk"],
      enabled: ["rtk"],
    });
  });

  it("never prints skill instructions", async () => {
    const output = await runResolveCommand({ packs: ["angular"], json: false, cwd: tmpdir() });

    expect(output).not.toContain("# Modern Angular");
  });

  it("fails on an unknown pack or enabled capability", async () => {
    await expect(
      runResolveCommand({ packs: ["svelte"], json: false, cwd: tmpdir() }),
    ).rejects.toThrow(UnknownPackError);
    await expect(
      runResolveCommand({
        packs: ["typescript"],
        enable: ["rtk"],
        json: false,
        cwd: tmpdir(),
      }),
    ).rejects.toThrow(UnknownEnabledCapabilityError);
  });
});

describe("agentyx resolve", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "agentyx-cli-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("renders the project configuration", async () => {
    await writeFile(
      join(projectPath, ".agentyx.json"),
      JSON.stringify({
        packs: ["technical", "typescript", "angular"],
        targets: ["codex", "kimi"],
      }),
      "utf8",
    );

    const output = await runResolveCommand({ packs: [], json: false, cwd: projectPath });

    expect(output).toContain("Agentyx configuration");
    expect(output).toContain("Targets\n  codex\n  kimi");
    expect(output).toContain("Packs\n  technical\n  typescript\n  angular");
    expect(output).toContain("MCP\n  context7    default");
  });

  it("emits the resolved configuration as JSON", async () => {
    const output = await runResolveCommand({ packs: [], json: true, cwd: exampleProjectPath });

    expect(JSON.parse(output)).toMatchObject({
      requestedPacks: ["technical", "typescript", "angular"],
      resolvedPacks: ["technical", "typescript", "angular"],
      targets: ["codex", "claude"],
    });
  });

  it("fails when the project has no configuration", async () => {
    await expect(runResolveCommand({ packs: [], json: false, cwd: projectPath })).rejects.toThrow(
      AgentyxConfigNotFoundError,
    );
  });

  it("prefers explicit packs over the project configuration", async () => {
    await writeFile(
      join(projectPath, ".agentyx.json"),
      JSON.stringify({ packs: ["angular"] }),
      "utf8",
    );

    const output = await runResolveCommand({
      packs: ["typescript"],
      json: false,
      cwd: projectPath,
    });

    expect(output).toContain("Packs\n  typescript\n");
    expect(output).not.toContain("angular");
  });
});

describe("resolve command wiring", () => {
  it("declares the packs argument and flags", () => {
    const command = createResolveCommand();

    expect(command.name()).toBe("resolve");
    expect(command.options.map((option) => option.long)).toEqual(["--enable", "--json"]);
    expect(command.registeredArguments.map((argument) => argument.name())).toEqual(["packs"]);
    expect(command.registeredArguments[0]?.variadic).toBe(true);
  });

  it("is registered on the agentyx program", () => {
    const names = createAgentyxProgram().commands.map((command) => command.name());

    expect(names).toContain("resolve");
  });
});
