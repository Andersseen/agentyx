import { describe, expect, it } from "vitest";
import {
  TOOL_ACTIVATION_LEVELS,
  toolDefinitionSchema,
  toolNameSchema,
  toolReferenceSchema,
} from "../src/tool/schema.js";

describe("toolNameSchema", () => {
  it("accepts lowercase kebab-case names", () => {
    expect(toolNameSchema.parse("rtk")).toBe("rtk");
    expect(toolNameSchema.parse("ripgrep-all")).toBe("ripgrep-all");
    expect(toolNameSchema.parse("tool2")).toBe("tool2");
  });

  it("rejects names that are not lowercase slugs", () => {
    for (const name of ["", "Rtk", "rtk_all", "rtk all", "-rtk", "rtk-", "rtk--all"]) {
      expect(() => toolNameSchema.parse(name), name).toThrow();
    }
  });
});

describe("toolReferenceSchema", () => {
  it("normalizes a bare name to default activation", () => {
    expect(toolReferenceSchema.parse("rtk")).toEqual({ name: "rtk", activation: "default" });
  });

  it("keeps an explicit activation", () => {
    expect(toolReferenceSchema.parse({ name: "rtk", activation: "optional" })).toEqual({
      name: "rtk",
      activation: "optional",
    });
  });

  it("defaults activation when the object omits it", () => {
    expect(toolReferenceSchema.parse({ name: "rtk" })).toEqual({
      name: "rtk",
      activation: "default",
    });
  });

  it("exposes exactly the documented activation levels", () => {
    expect(TOOL_ACTIVATION_LEVELS).toEqual(["default", "optional"]);
  });

  it("rejects unknown activation levels and extra keys", () => {
    expect(() => toolReferenceSchema.parse({ name: "rtk", activation: "recommended" })).toThrow();
    expect(() => toolReferenceSchema.parse({ name: "rtk", level: "optional" })).toThrow();
  });
});

describe("toolDefinitionSchema", () => {
  const valid = {
    name: "rtk",
    description: "Command-output proxy.",
    kind: "executable",
    command: "rtk",
  };

  it("applies the optional default", () => {
    expect(toolDefinitionSchema.parse(valid)).toEqual({ ...valid, optional: true });
  });

  it("keeps an install hint when provided", () => {
    expect(
      toolDefinitionSchema.parse({ ...valid, installHint: "Install from source." }),
    ).toMatchObject({ installHint: "Install from source." });
  });

  it("rejects a kind other than executable", () => {
    expect(() => toolDefinitionSchema.parse({ ...valid, kind: "mcp" })).toThrow();
  });

  it("rejects blank descriptions, commands and hints", () => {
    expect(() => toolDefinitionSchema.parse({ ...valid, description: "  " })).toThrow();
    expect(() => toolDefinitionSchema.parse({ ...valid, command: "  " })).toThrow();
    expect(() => toolDefinitionSchema.parse({ ...valid, installHint: "  " })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => toolDefinitionSchema.parse({ ...valid, transport: "stdio" })).toThrow();
  });
});
