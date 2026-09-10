import { describe, expect, it } from "vitest";
import { hookDefinitionSchema, hookReferenceSchema } from "../src/hook/schema.js";

describe("hookDefinitionSchema", () => {
  it("accepts a SessionStart hook", () => {
    expect(
      hookDefinitionSchema.parse({
        name: "session-doctor-bootstrap",
        description: "Reports project health at session start.",
        event: "SessionStart",
        command: "npx",
        args: ["agentyx", "doctor", "--hook"],
      }),
    ).toMatchObject({ event: "SessionStart", command: "npx" });
  });

  it("defaults args to an empty array", () => {
    expect(
      hookDefinitionSchema.parse({
        name: "no-args",
        description: "No args.",
        event: "SessionStart",
        command: "agentyx",
      }),
    ).toMatchObject({ args: [] });
  });

  it("rejects invalid definitions", () => {
    expect(() =>
      hookDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        event: "SomeOtherEvent",
        command: "agentyx",
      }),
    ).toThrow();
    expect(() =>
      hookDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        event: "SessionStart",
        command: "",
      }),
    ).toThrow();
    expect(() =>
      hookDefinitionSchema.parse({
        name: "Bad Name",
        description: "Bad.",
        event: "SessionStart",
        command: "agentyx",
      }),
    ).toThrow();
  });
});

describe("hookReferenceSchema", () => {
  it("accepts explicit activation levels", () => {
    expect(
      hookReferenceSchema.parse({ name: "session-doctor-bootstrap", activation: "default" }),
    ).toEqual({
      name: "session-doctor-bootstrap",
      activation: "default",
    });
  });

  it("keeps string references backward-compatible as default", () => {
    expect(hookReferenceSchema.parse("session-doctor-bootstrap")).toEqual({
      name: "session-doctor-bootstrap",
      activation: "default",
    });
  });
});
