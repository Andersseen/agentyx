import { describe, expect, it } from "vitest";
import { createPackCommand, runPackListCommand, runPackShowCommand } from "../src/commands/pack.js";
import { createAgentyxProgram } from "../src/index.js";

describe("agentyx pack list", () => {
  it("lists packs and categories", () => {
    expect(runPackListCommand()).toBe(
      [
        "technical      engineering",
        "typescript     language",
        "angular        framework",
        "efficiency     efficiency",
        "agentic        workflow",
        "testing        engineering",
        "security       engineering",
        "performance    engineering",
        "accessibility  engineering",
        "refactoring    engineering",
        "documentation  engineering",
        "observability  engineering",
        "data           engineering",
        "git            workflow",
        "devops         workflow",
      ].join("\n"),
    );
  });
});

describe("agentyx pack show", () => {
  it("shows pack capabilities", () => {
    const output = runPackShowCommand({ name: "efficiency", json: false });

    expect(output).toContain("efficiency");
    expect(output).toContain("category: efficiency");
    expect(output).toContain("context-efficient-development");
    expect(output).toContain("codebase-memory    optional");
    expect(output).toContain("rtk    optional");
  });

  it("prints JSON", () => {
    expect(JSON.parse(runPackShowCommand({ name: "angular", json: true }))).toMatchObject({
      name: "angular",
      category: "framework",
    });
  });
});

describe("pack command wiring", () => {
  it("has list and show subcommands", () => {
    expect(createPackCommand().commands.map((command) => command.name())).toEqual(["list", "show"]);
  });

  it("is part of the top-level program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("pack");
    expect(createAgentyxProgram().commands.map((command) => command.name())).not.toContain(
      "profile",
    );
  });
});
