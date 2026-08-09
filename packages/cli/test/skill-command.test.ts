import { UnknownSkillError } from "@agentyx/core";
import { describe, expect, it } from "vitest";
import {
  createSkillCommand,
  runSkillListCommand,
  runSkillShowCommand,
} from "../src/commands/skill.js";
import { createAgentyxProgram } from "../src/index.js";

describe("agentyx skill list", () => {
  it("prints the built-in skill identifiers", () => {
    expect(runSkillListCommand()).toBe(
      [
        "planning",
        "systematic-debugging",
        "verification",
        "typescript-modern",
        "angular-modern",
      ].join("\n"),
    );
  });
});

describe("agentyx skill show", () => {
  it("prints the name, the description and the instructions", () => {
    const output = runSkillShowCommand({ name: "angular-modern", json: false });
    const [name, description, blank, ...body] = output.split("\n");

    expect(name).toBe("angular-modern");
    expect(description).toMatch(/^Modern Angular conventions/);
    expect(blank).toBe("");
    expect(body.join("\n")).toContain("# Modern Angular");
  });

  it("prints the whole skill as JSON in --json mode", () => {
    const output = runSkillShowCommand({ name: "planning", json: true });

    expect(JSON.parse(output)).toEqual({
      name: "planning",
      description: expect.any(String),
      content: expect.stringContaining("# Planning"),
    });
  });

  it("fails on an unknown skill", () => {
    expect(() => runSkillShowCommand({ name: "nonexistent", json: false })).toThrow(
      UnknownSkillError,
    );
    expect(() => runSkillShowCommand({ name: "nonexistent", json: false })).toThrow(
      /Unknown skill "nonexistent"/,
    );
  });
});

describe("skill command wiring", () => {
  it("declares list and show, and nothing that installs", () => {
    const skill = createSkillCommand();

    expect(skill.name()).toBe("skill");
    expect(skill.commands.map((command) => command.name()).sort()).toEqual(["list", "show"]);
  });

  it("declares the name argument and the --json flag on show", () => {
    const show = createSkillCommand().commands.find((command) => command.name() === "show");

    expect(show?.registeredArguments.map((argument) => argument.name())).toEqual(["name"]);
    expect(show?.registeredArguments[0]?.required).toBe(true);
    expect(show?.options.map((option) => option.long)).toContain("--json");
  });

  it("is registered on the agentyx program", () => {
    const names = createAgentyxProgram().commands.map((command) => command.name());

    expect(names).toContain("skill");
  });
});
