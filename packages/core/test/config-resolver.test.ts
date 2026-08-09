import { describe, expect, it } from "vitest";
import { parseAgentyxConfig } from "../src/config/loader.js";
import { resolveAgentyxConfig } from "../src/config/resolver.js";
import { UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry } from "../src/skill/registry.js";
import { UnknownStackError } from "../src/stack/errors.js";
import { createStackRegistry } from "../src/stack/registry.js";

describe("resolveAgentyxConfig", () => {
  it("composes requested and inherited stacks", () => {
    const config = parseAgentyxConfig({
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex"],
    });

    expect(resolveAgentyxConfig(config)).toEqual({
      requestedStacks: ["angular"],
      resolvedStacks: ["core", "typescript", "angular"],
      skills: [
        "planning",
        "systematic-debugging",
        "verification",
        "typescript-modern",
        "angular-modern",
      ],
      declaredMcpServers: [{ name: "context7", level: "recommended" }],
      mcpServers: ["context7"],
      profile: "balanced",
      targets: ["codex"],
    });
  });

  it("orders the resolved fields for readable JSON output", () => {
    const resolved = resolveAgentyxConfig(parseAgentyxConfig({ extends: ["angular"] }));

    expect(Object.keys(resolved)).toEqual([
      "requestedStacks",
      "resolvedStacks",
      "skills",
      "declaredMcpServers",
      "mcpServers",
      "profile",
      "targets",
    ]);
  });

  it("collects skills in resolved stack order without duplicates", () => {
    const resolved = resolveAgentyxConfig(
      parseAgentyxConfig({ extends: ["typescript", "angular"] }),
    );

    expect(resolved.skills).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
      "typescript-modern",
      "angular-modern",
    ]);
  });

  it("keeps the requested stacks separate from the resolved chain", () => {
    const resolved = resolveAgentyxConfig(
      parseAgentyxConfig({ extends: ["typescript", "angular"] }),
    );

    expect(resolved.requestedStacks).toEqual(["typescript", "angular"]);
    expect(resolved.resolvedStacks).toEqual(["core", "typescript", "angular"]);
  });

  it("resolves an empty configuration to no stacks", () => {
    expect(resolveAgentyxConfig(parseAgentyxConfig({}))).toEqual({
      requestedStacks: [],
      resolvedStacks: [],
      skills: [],
      declaredMcpServers: [],
      mcpServers: [],
      profile: "balanced",
      targets: [],
    });
  });

  it("keeps declared MCP visible when a lean profile filters it out", () => {
    const resolved = resolveAgentyxConfig(
      parseAgentyxConfig({ extends: ["angular"], profile: "lean" }),
    );

    expect(resolved.declaredMcpServers).toEqual([{ name: "context7", level: "recommended" }]);
    expect(resolved.mcpServers).toEqual([]);
  });

  it("does not mutate the input configuration", () => {
    const config = parseAgentyxConfig({ extends: ["angular"], targets: ["codex"] });
    const snapshot = structuredClone(config);

    const resolved = resolveAgentyxConfig(config);

    expect(config).toEqual(snapshot);
    expect(resolved.requestedStacks).not.toBe(config.extends);
    expect(resolved.targets).not.toBe(config.targets);
  });

  it("accepts a custom registry", () => {
    const registry = createStackRegistry([{ name: "base" }, { name: "app", extends: ["base"] }]);

    expect(
      resolveAgentyxConfig(parseAgentyxConfig({ extends: ["app"] }), registry).resolvedStacks,
    ).toEqual(["base", "app"]);
  });

  it("accepts a custom skill registry", () => {
    const stacks = createStackRegistry([{ name: "app", skills: ["a"] }]);
    const skills = createSkillRegistry([
      { name: "a", load: () => ({ name: "a", description: "A.", content: "Do a." }) },
    ]);

    expect(
      resolveAgentyxConfig(parseAgentyxConfig({ extends: ["app"] }), stacks, skills).skills,
    ).toEqual(["a"]);
  });

  it("propagates unknown stacks", () => {
    expect(() => resolveAgentyxConfig(parseAgentyxConfig({ extends: ["svelte"] }))).toThrow(
      UnknownStackError,
    );
  });

  it("propagates unknown skills", () => {
    const registry = createStackRegistry([{ name: "app", skills: ["missing"] }]);

    expect(() => resolveAgentyxConfig(parseAgentyxConfig({ extends: ["app"] }), registry)).toThrow(
      UnknownSkillError,
    );
  });
});
