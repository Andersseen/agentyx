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
      skillDirectories: [".agentyx/skills"],
      localPacks: [{ name: "team", category: "workflow", skills: ["team-review"] }],
      trustedSources: [
        { name: "superpowers", path: ".agentyx/sources/superpowers", ref: "v5.1.0" },
      ],
    });

    expect(config).toEqual({
      $schema: "./node_modules/@agentyx/core/schema/agentyx.schema.json",
      packs: ["technical", "typescript", "angular"],
      enable: ["rtk"],
      targets: ["codex", "claude", "kimi"],
      skillDirectories: [".agentyx/skills"],
      localPacks: [
        {
          name: "team",
          category: "workflow",
          skills: ["team-review"],
          mcpServers: [],
          tools: [],
        },
      ],
      trustedSources: [
        { name: "superpowers", path: ".agentyx/sources/superpowers", ref: "v5.1.0" },
      ],
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

  it("rejects unsafe or platform-specific Skill directory paths", () => {
    for (const skillDirectory of ["../skills", "/tmp/skills", "C:/skills", "skills\\team"]) {
      expect(() => parseAgentyxConfig({ skillDirectories: [skillDirectory] })).toThrow(
        AgentyxConfigValidationError,
      );
    }
  });

  it("rejects unsafe or platform-specific trusted source paths", () => {
    for (const path of ["../superpowers", "/tmp/superpowers", "C:/superpowers", "sources\\repo"]) {
      expect(() =>
        parseAgentyxConfig({ trustedSources: [{ name: "superpowers", path, ref: "v5.1.0" }] }),
      ).toThrow(AgentyxConfigValidationError);
    }
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
