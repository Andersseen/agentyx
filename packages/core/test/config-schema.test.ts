import { describe, expect, it } from "vitest";
import { AgnoxConfigValidationError } from "../src/config/errors.js";
import { parseAgnoxConfig } from "../src/config/loader.js";
import { AGNOX_PROFILES, agnoxConfigSchema } from "../src/config/schema.js";

describe("agnoxConfigSchema", () => {
  it("accepts a full configuration", () => {
    const config = agnoxConfigSchema.parse({
      $schema: "./node_modules/@agnox/core/schema/agnox.schema.json",
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex", "claude", "kimi"],
    });

    expect(config).toEqual({
      $schema: "./node_modules/@agnox/core/schema/agnox.schema.json",
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex", "claude", "kimi"],
    });
  });

  it("defaults extends, profile and targets", () => {
    expect(agnoxConfigSchema.parse({})).toEqual({
      extends: [],
      profile: "balanced",
      targets: [],
    });
  });

  it("accepts every documented profile", () => {
    for (const profile of AGNOX_PROFILES) {
      expect(agnoxConfigSchema.parse({ profile }).profile).toBe(profile);
    }
  });

  it("does not mutate the parsed input", () => {
    const input = { extends: ["angular"] };
    const config = agnoxConfigSchema.parse(input);

    config.extends.push("typescript");

    expect(input.extends).toEqual(["angular"]);
  });
});

describe("parseAgnoxConfig", () => {
  it("rejects an unknown profile", () => {
    expect(() => parseAgnoxConfig({ profile: "yolo" })).toThrow(AgnoxConfigValidationError);

    try {
      parseAgnoxConfig({ profile: "yolo" });
      expect.unreachable("expected an AgnoxConfigValidationError");
    } catch (error) {
      const issues = (error as AgnoxConfigValidationError).issues;
      expect(issues).toEqual([
        { path: "profile", message: "Profile must be one of: lean, balanced, autonomous." },
      ]);
    }
  });

  it("rejects an empty stack name in extends", () => {
    try {
      parseAgnoxConfig({ extends: ["angular", ""] });
      expect.unreachable("expected an AgnoxConfigValidationError");
    } catch (error) {
      expect((error as AgnoxConfigValidationError).issues).toEqual([
        { path: "extends[1]", message: "Stack names must be non-empty strings." },
      ]);
    }
  });

  it("rejects non-string values in extends", () => {
    expect(() => parseAgnoxConfig({ extends: [42] })).toThrow(AgnoxConfigValidationError);
  });

  it("rejects extends that is not an array", () => {
    expect(() => parseAgnoxConfig({ extends: "angular" })).toThrow(AgnoxConfigValidationError);
  });

  it("rejects an empty target name", () => {
    try {
      parseAgnoxConfig({ targets: [""] });
      expect.unreachable("expected an AgnoxConfigValidationError");
    } catch (error) {
      expect((error as AgnoxConfigValidationError).issues).toEqual([
        { path: "targets[0]", message: "Targets must be non-empty strings." },
      ]);
    }
  });

  it("accepts targets that are not known to Agnox yet", () => {
    expect(parseAgnoxConfig({ targets: ["some-third-party-adapter"] }).targets).toEqual([
      "some-third-party-adapter",
    ]);
  });

  it("rejects unknown top-level keys", () => {
    expect(() => parseAgnoxConfig({ skills: ["angular"] })).toThrow(AgnoxConfigValidationError);
  });

  it("rejects a non-object document", () => {
    try {
      parseAgnoxConfig([]);
      expect.unreachable("expected an AgnoxConfigValidationError");
    } catch (error) {
      expect((error as AgnoxConfigValidationError).issues[0]?.path).toBe("(root)");
    }
  });

  it("mentions the source file when one is supplied", () => {
    expect(() => parseAgnoxConfig({ profile: "yolo" }, "/tmp/.agnox.json")).toThrow(
      /Invalid Agnox configuration in \/tmp\/\.agnox\.json/,
    );
  });
});
