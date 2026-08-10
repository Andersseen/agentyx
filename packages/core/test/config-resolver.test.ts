import { describe, expect, it } from "vitest";
import {
  parseAgentyxConfig,
  resolveAgentyxConfig,
  UnknownEnabledCapabilityError,
} from "../src/index.js";
import { UnknownPackError } from "../src/pack/errors.js";
import { createPackRegistry } from "../src/pack/registry.js";
import { UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry } from "../src/skill/registry.js";

describe("resolveAgentyxConfig", () => {
  it("composes selected packs without hidden inheritance", () => {
    const config = parseAgentyxConfig({
      packs: ["technical", "typescript", "angular"],
      targets: ["codex"],
    });

    expect(resolveAgentyxConfig(config)).toMatchObject({
      requestedPacks: ["technical", "typescript", "angular"],
      resolvedPacks: ["technical", "typescript", "angular"],
      mcpServers: ["context7"],
      tools: [],
      enabled: [],
      targets: ["codex"],
    });
  });

  it("orders resolved fields for readable JSON output", () => {
    const resolved = resolveAgentyxConfig(parseAgentyxConfig({ packs: ["efficiency"] }));

    expect(Object.keys(resolved)).toEqual([
      "requestedPacks",
      "resolvedPacks",
      "skills",
      "declaredMcpServers",
      "mcpServers",
      "declaredTools",
      "tools",
      "enabled",
      "targets",
    ]);
  });

  it("keeps optional capabilities inactive until enabled", () => {
    const disabled = resolveAgentyxConfig(parseAgentyxConfig({ packs: ["efficiency"] }));
    const enabled = resolveAgentyxConfig(
      parseAgentyxConfig({ packs: ["efficiency"], enable: ["rtk", "codebase-memory"] }),
    );

    expect(disabled.declaredMcpServers).toEqual([
      { name: "codebase-memory", activation: "optional" },
    ]);
    expect(disabled.mcpServers).toEqual([]);
    expect(disabled.declaredTools).toEqual([{ name: "rtk", activation: "optional" }]);
    expect(disabled.tools).toEqual([]);
    expect(enabled.mcpServers).toEqual(["codebase-memory"]);
    expect(enabled.tools).toEqual(["rtk"]);
  });

  it("resolves an empty configuration to no packs", () => {
    expect(resolveAgentyxConfig(parseAgentyxConfig({}))).toEqual({
      requestedPacks: [],
      resolvedPacks: [],
      skills: [],
      declaredMcpServers: [],
      mcpServers: [],
      declaredTools: [],
      tools: [],
      enabled: [],
      targets: [],
    });
  });

  it("does not mutate the input configuration", () => {
    const config = parseAgentyxConfig({ packs: ["angular"], targets: ["codex"] });
    const snapshot = structuredClone(config);

    const resolved = resolveAgentyxConfig(config);

    expect(config).toEqual(snapshot);
    expect(resolved.requestedPacks).not.toBe(config.packs);
    expect(resolved.targets).not.toBe(config.targets);
  });

  it("accepts custom registries", () => {
    const packs = createPackRegistry([{ name: "app", skills: ["a"] }]);
    const skills = createSkillRegistry([
      { name: "a", load: () => ({ name: "a", description: "A.", content: "Do a." }) },
    ]);

    expect(
      resolveAgentyxConfig(parseAgentyxConfig({ packs: ["app"] }), packs, skills).skills,
    ).toEqual(["a"]);
  });

  it("propagates unknown packs, skills, and enabled capabilities", () => {
    expect(() => resolveAgentyxConfig(parseAgentyxConfig({ packs: ["svelte"] }))).toThrow(
      UnknownPackError,
    );

    const registry = createPackRegistry([{ name: "app", skills: ["missing"] }]);
    expect(() => resolveAgentyxConfig(parseAgentyxConfig({ packs: ["app"] }), registry)).toThrow(
      UnknownSkillError,
    );

    expect(() =>
      resolveAgentyxConfig(parseAgentyxConfig({ packs: ["typescript"], enable: ["rtk"] })),
    ).toThrow(UnknownEnabledCapabilityError);
  });
});
