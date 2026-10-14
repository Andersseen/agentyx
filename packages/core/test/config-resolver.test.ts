import { describe, expect, it } from "vitest";
import {
  ContradictoryCapabilitySelectionError,
  parseAgentyxConfig,
  resolveAgentyxConfig,
  UnknownEnabledCapabilityError,
  UnknownExcludedCapabilityError,
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
      "declaredHooks",
      "hooks",
      "declaredAgents",
      "agents",
      "enabled",
      "excluded",
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
    expect(disabled.hooks).toEqual([
      "session-doctor-bootstrap",
      "observe-session-start",
      "observe-session-end",
      "observe-tool-use",
    ]);
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
      declaredHooks: [],
      hooks: [],
      declaredAgents: [],
      agents: [],
      enabled: [],
      excluded: { skills: [], mcpServers: [], tools: [], hooks: [], agents: [] },
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
    expect(
      resolveAgentyxConfig(
        parseAgentyxConfig({ packs: ["app"], exclude: { skills: ["a"] } }),
        packs,
        skills,
      ).skills,
    ).toEqual([]);
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

  it("removes typed exclusions from effective capabilities while preserving declarations", () => {
    const resolved = resolveAgentyxConfig(
      parseAgentyxConfig({
        packs: ["technical", "ui-ux"],
        exclude: { skills: ["api-design"], mcpServers: ["playwright"] },
      }),
    );

    expect(resolved.skills).not.toContain("api-design");
    expect(resolved.declaredMcpServers).toContainEqual({
      name: "playwright",
      activation: "optional",
    });
    expect(resolved.mcpServers).not.toContain("playwright");
    expect(resolved.excluded).toEqual({
      skills: ["api-design"],
      mcpServers: ["playwright"],
      tools: [],
      hooks: [],
      agents: [],
    });
  });

  it("validates exclusions by kind and selected declarations", () => {
    expect(() =>
      resolveAgentyxConfig(
        parseAgentyxConfig({ packs: ["ui-ux"], exclude: { skills: ["playwright"] } }),
      ),
    ).toThrow(UnknownExcludedCapabilityError);
    expect(() =>
      resolveAgentyxConfig(
        parseAgentyxConfig({ packs: ["typescript"], exclude: { skills: ["api-design"] } }),
      ),
    ).toThrow(UnknownExcludedCapabilityError);
    expect(() =>
      resolveAgentyxConfig(
        parseAgentyxConfig({
          packs: ["ui-ux"],
          enable: ["playwright"],
          exclude: { mcpServers: ["playwright"] },
        }),
      ),
    ).toThrow(ContradictoryCapabilitySelectionError);
  });

  it("does not treat synthesized project context as a pack capability", () => {
    expect(() =>
      resolveAgentyxConfig(
        parseAgentyxConfig({
          project: { id: "web", name: "Web" },
          exclude: { skills: ["agentyx-project-context"] },
        }),
      ),
    ).toThrow(UnknownExcludedCapabilityError);
  });
});
