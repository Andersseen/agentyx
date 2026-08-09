import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnknownAdapterError } from "@agentyx/adapters";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTargetCommand,
  runTargetListCommand,
  runTargetShowCommand,
} from "../src/commands/target.js";
import { createAgentyxProgram } from "../src/index.js";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-target-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("agentyx target list", () => {
  it("prints the installable target ids", () => {
    expect(runTargetListCommand()).toBe(["codex", "claude", "kimi"].join("\n"));
  });
});

describe("agentyx target show", () => {
  it("prints the id, the provider name and the project destination", async () => {
    expect(await runTargetShowCommand({ target: "codex", json: false, cwd: projectDir })).toBe(
      [
        "codex",
        "Codex",
        "Skills: .agents/skills (not present)",
        "MCP: .codex/config.toml",
        "MCP transports: stdio, http",
        "Reference: https://developers.openai.com/codex/skills",
        "Reference: https://developers.openai.com/codex/mcp",
      ].join("\n"),
    );
    expect(await runTargetShowCommand({ target: "claude", json: false, cwd: projectDir })).toBe(
      [
        "claude",
        "Claude Code",
        "Skills: .claude/skills (not present)",
        "MCP: .mcp.json",
        "MCP transports: stdio, http",
        "Reference: https://code.claude.com/docs/en/skills",
        "Reference: https://docs.anthropic.com/en/docs/claude-code/mcp",
      ].join("\n"),
    );
    expect(await runTargetShowCommand({ target: "kimi", json: false, cwd: projectDir })).toBe(
      [
        "kimi",
        "Kimi Code",
        "Skills: .agents/skills (not present)",
        "MCP: .kimi-code/mcp.json",
        "MCP transports: stdio, http",
        "Reference: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html",
        "Reference: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html",
      ].join("\n"),
    );
  });

  it("reports a destination that already exists", async () => {
    await mkdir(join(projectDir, ".agents", "skills"), { recursive: true });

    expect(await runTargetShowCommand({ target: "codex", json: false, cwd: projectDir })).toBe(
      [
        "codex",
        "Codex",
        "Skills: .agents/skills",
        "MCP: .codex/config.toml",
        "MCP transports: stdio, http",
        "Reference: https://developers.openai.com/codex/skills",
        "Reference: https://developers.openai.com/codex/mcp",
      ].join("\n"),
    );
  });

  it("prints machine-readable metadata in --json mode", async () => {
    const output = await runTargetShowCommand({ target: "claude", json: true, cwd: projectDir });

    expect(JSON.parse(output)).toEqual({
      id: "claude",
      name: "Claude Code",
      skillsPath: ".claude/skills",
      present: false,
      mcp: {
        project: true,
        path: ".mcp.json",
        transports: ["stdio", "http"],
      },
      references: [
        "https://code.claude.com/docs/en/skills",
        "https://docs.anthropic.com/en/docs/claude-code/mcp",
      ],
    });
  });

  it("exposes no adapter internals", async () => {
    const output = await runTargetShowCommand({ target: "codex", json: true, cwd: projectDir });

    expect(Object.keys(JSON.parse(output)).sort()).toEqual([
      "id",
      "mcp",
      "name",
      "present",
      "references",
      "skillsPath",
    ]);
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

  it("is registered on the agentyx program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("target");
  });
});
