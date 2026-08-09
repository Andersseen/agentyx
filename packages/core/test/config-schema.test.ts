import { describe, expect, it } from "vitest";
import { AgentyxConfigValidationError } from "../src/config/errors.js";
import { parseAgentyxConfig } from "../src/config/loader.js";
import { AGENTYX_PROFILES, agentyxConfigSchema } from "../src/config/schema.js";

describe("agentyxConfigSchema", () => {
  it("accepts a full configuration", () => {
    const config = agentyxConfigSchema.parse({
      $schema: "./node_modules/@agentyx/core/schema/agentyx.schema.json",
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex", "claude", "kimi"],
    });

    expect(config).toEqual({
      $schema: "./node_modules/@agentyx/core/schema/agentyx.schema.json",
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex", "claude", "kimi"],
    });
  });

  it("defaults extends, profile and targets", () => {
    expect(agentyxConfigSchema.parse({})).toEqual({
      extends: [],
      profile: "balanced",
      targets: [],
    });
  });

  it("accepts every documented profile", () => {
    for (const profile of AGENTYX_PROFILES) {
      expect(agentyxConfigSchema.parse({ profile }).profile).toBe(profile);
    }
  });

  it("does not mutate the parsed input", () => {
    const input = { extends: ["angular"] };
    const config = agentyxConfigSchema.parse(input);

    config.extends.push("typescript");

    expect(input.extends).toEqual(["angular"]);
  });
});

describe("parseAgentyxConfig", () => {
  it("rejects an unknown profile", () => {
    expect(() => parseAgentyxConfig({ profile: "yolo" })).toThrow(AgentyxConfigValidationError);

    try {
      parseAgentyxConfig({ profile: "yolo" });
      expect.unreachable("expected an AgentyxConfigValidationError");
    } catch (error) {
      const issues = (error as AgentyxConfigValidationError).issues;
      expect(issues).toEqual([
        { path: "profile", message: "Profile must be one of: lean, balanced, autonomous." },
      ]);
    }
  });

  it("rejects an empty stack name in extends", () => {
    try {
      parseAgentyxConfig({ extends: ["angular", ""] });
      expect.unreachable("expected an AgentyxConfigValidationError");
    } catch (error) {
      expect((error as AgentyxConfigValidationError).issues).toEqual([
        { path: "extends[1]", message: "Stack names must be non-empty strings." },
      ]);
    }
  });

  it("rejects non-string values in extends", () => {
    expect(() => parseAgentyxConfig({ extends: [42] })).toThrow(AgentyxConfigValidationError);
  });

  it("rejects extends that is not an array", () => {
    expect(() => parseAgentyxConfig({ extends: "angular" })).toThrow(AgentyxConfigValidationError);
  });

  it("rejects an empty target name", () => {
    try {
      parseAgentyxConfig({ targets: [""] });
      expect.unreachable("expected an AgentyxConfigValidationError");
    } catch (error) {
      expect((error as AgentyxConfigValidationError).issues).toEqual([
        { path: "targets[0]", message: "Targets must be non-empty strings." },
      ]);
    }
  });

  it("accepts targets that are not known to Agentyx yet", () => {
    expect(parseAgentyxConfig({ targets: ["some-third-party-adapter"] }).targets).toEqual([
      "some-third-party-adapter",
    ]);
  });

  it("rejects unknown top-level keys", () => {
    expect(() => parseAgentyxConfig({ skills: ["angular"] })).toThrow(AgentyxConfigValidationError);
  });

  it("rejects a non-object document", () => {
    try {
      parseAgentyxConfig([]);
      expect.unreachable("expected an AgentyxConfigValidationError");
    } catch (error) {
      expect((error as AgentyxConfigValidationError).issues[0]?.path).toBe("(root)");
    }
  });

  it("mentions the source file when one is supplied", () => {
    expect(() => parseAgentyxConfig({ profile: "yolo" }, "/tmp/.agentyx.json")).toThrow(
      /Invalid Agentyx configuration in \/tmp\/\.agentyx\.json/,
    );
  });
});
