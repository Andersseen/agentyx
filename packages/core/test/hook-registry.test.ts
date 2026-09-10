import { describe, expect, it } from "vitest";
import {
  builtInHookRegistry,
  createHookRegistry,
  DuplicateHookError,
  UnknownHookError,
} from "../src/index.js";

describe("builtInHookRegistry", () => {
  it("lists the built-in hooks", () => {
    expect(builtInHookRegistry.names).toEqual(["session-doctor-bootstrap"]);
  });

  it("retrieves known hooks and metadata", () => {
    expect(builtInHookRegistry.get("session-doctor-bootstrap")).toMatchObject({
      name: "session-doctor-bootstrap",
      event: "SessionStart",
      command: "npx",
      args: ["agentyx", "doctor", "--hook"],
    });
    expect(builtInHookRegistry.listMetadata()).toEqual([
      {
        name: "session-doctor-bootstrap",
        description: "Reports Agentyx project health at session start; silent when healthy.",
        event: "SessionStart",
      },
    ]);
  });

  it("fails on unknown and duplicate hooks", () => {
    expect(() => builtInHookRegistry.get("nope")).toThrow(UnknownHookError);
    expect(() =>
      createHookRegistry([
        { name: "dupe", load: () => valid("dupe") },
        { name: "dupe", load: () => valid("dupe") },
      ]),
    ).toThrow(DuplicateHookError);
  });
});

function valid(name: string) {
  return {
    name,
    description: "Test.",
    event: "SessionStart" as const,
    command: "agentyx",
  };
}
