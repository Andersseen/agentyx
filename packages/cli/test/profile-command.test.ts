import { describe, expect, it } from "vitest";
import {
  createProfileCommand,
  runProfileListCommand,
  runProfileShowCommand,
} from "../src/commands/profile.js";
import { createAgentyxProgram } from "../src/index.js";

describe("agentyx profile list", () => {
  it("lists optimization profiles", () => {
    expect(runProfileListCommand()).toBe(["lean", "balanced", "autonomous"].join("\n"));
  });
});

describe("agentyx profile show", () => {
  it("shows a concise text summary", () => {
    expect(runProfileShowCommand({ name: "lean", json: false })).toBe(
      [
        "lean",
        "Minimum context and tool overhead.",
        "",
        "MCP",
        "  essential",
        "Notes",
        "  Installs all resolved Skills.",
        "  Keeps MCP exposure to essential capabilities.",
        "  Prefers local CLI or native tools when they cover the same workflow.",
      ].join("\n"),
    );
  });

  it("prints JSON", () => {
    expect(JSON.parse(runProfileShowCommand({ name: "autonomous", json: true }))).toEqual({
      name: "autonomous",
      goal: "Maximum agent capability from declared stack capabilities.",
      mcpLevels: ["essential", "recommended", "optional"],
      notes: [
        "Installs all resolved Skills.",
        "Includes optional MCP capabilities declared by the selected stacks.",
      ],
    });
  });
});

describe("profile command wiring", () => {
  it("declares list and show", () => {
    expect(createProfileCommand().commands.map((command) => command.name())).toEqual([
      "list",
      "show",
    ]);
  });

  it("is registered on the agentyx program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("profile");
  });
});
