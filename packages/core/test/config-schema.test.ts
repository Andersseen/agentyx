import { describe, expect, it } from "vitest";
import { AgentyxConfigValidationError } from "../src/config/errors.js";
import { parseAgentyxConfig } from "../src/config/loader.js";
import { agentyxConfigSchema } from "../src/config/schema.js";

describe("agentyxConfigSchema", () => {
  it("accepts a full configuration", () => {
    const config = agentyxConfigSchema.parse({
      $schema: "./node_modules/@agentyx/core/schema/agentyx.schema.json",
      packs: ["technical", "typescript", "angular"],
      enable: ["rtk"],
      targets: ["codex", "claude", "kimi"],
    });

    expect(config).toEqual({
      $schema: "./node_modules/@agentyx/core/schema/agentyx.schema.json",
      packs: ["technical", "typescript", "angular"],
      enable: ["rtk"],
      targets: ["codex", "claude", "kimi"],
    });
  });

  it("defaults packs, enable and targets", () => {
    expect(agentyxConfigSchema.parse({})).toEqual({
      packs: [],
      enable: [],
      targets: [],
    });
  });

  it("does not mutate the parsed input", () => {
    const input = { packs: ["angular"] };
    const config = agentyxConfigSchema.parse(input);

    config.packs.push("typescript");

    expect(input.packs).toEqual(["angular"]);
  });
});

describe("parseAgentyxConfig", () => {
  it("rejects an empty pack name", () => {
    try {
      parseAgentyxConfig({ packs: ["angular", ""] });
      expect.unreachable("expected an AgentyxConfigValidationError");
    } catch (error) {
      expect((error as AgentyxConfigValidationError).issues).toEqual([
        { path: "packs[1]", message: "Pack names must be non-empty strings." },
      ]);
    }
  });

  it("rejects invalid enable names", () => {
    expect(() => parseAgentyxConfig({ enable: ["RTK"] })).toThrow(AgentyxConfigValidationError);
  });

  it("rejects non-string values in packs", () => {
    expect(() => parseAgentyxConfig({ packs: [42] })).toThrow(AgentyxConfigValidationError);
  });

  it("rejects packs that are not an array", () => {
    expect(() => parseAgentyxConfig({ packs: "angular" })).toThrow(AgentyxConfigValidationError);
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

  it("mentions the source file when one is supplied", () => {
    expect(() => parseAgentyxConfig({ profile: "yolo" }, "/tmp/.agentyx.json")).toThrow(
      /Invalid Agentyx configuration in \/tmp\/\.agentyx\.json/,
    );
  });
});
