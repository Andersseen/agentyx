import { describe, expect, it } from "vitest";
import { parseAgnoxConfig } from "../src/config/loader.js";
import { resolveAgnoxConfig } from "../src/config/resolver.js";
import { UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry } from "../src/skill/registry.js";
import { UnknownStackError } from "../src/stack/errors.js";
import { createStackRegistry } from "../src/stack/registry.js";

describe("resolveAgnoxConfig", () => {
  it("composes requested and inherited stacks", () => {
    const config = parseAgnoxConfig({
      extends: ["angular"],
      profile: "balanced",
      targets: ["codex"],
    });

    expect(resolveAgnoxConfig(config)).toEqual({
      requestedStacks: ["angular"],
      resolvedStacks: ["core", "typescript", "angular"],
      skills: [
        "planning",
        "systematic-debugging",
        "verification",
        "typescript-modern",
        "angular-modern",
      ],
      mcpServers: ["context7"],
      profile: "balanced",
      targets: ["codex"],
    });
  });

  it("orders the resolved fields for readable JSON output", () => {
    const resolved = resolveAgnoxConfig(parseAgnoxConfig({ extends: ["angular"] }));

    expect(Object.keys(resolved)).toEqual([
      "requestedStacks",
      "resolvedStacks",
      "skills",
      "mcpServers",
      "profile",
      "targets",
    ]);
  });

  it("collects skills in resolved stack order without duplicates", () => {
    const resolved = resolveAgnoxConfig(parseAgnoxConfig({ extends: ["typescript", "angular"] }));

    expect(resolved.skills).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
      "typescript-modern",
      "angular-modern",
    ]);
  });

  it("keeps the requested stacks separate from the resolved chain", () => {
    const resolved = resolveAgnoxConfig(parseAgnoxConfig({ extends: ["typescript", "angular"] }));

    expect(resolved.requestedStacks).toEqual(["typescript", "angular"]);
    expect(resolved.resolvedStacks).toEqual(["core", "typescript", "angular"]);
  });

  it("resolves an empty configuration to no stacks", () => {
    expect(resolveAgnoxConfig(parseAgnoxConfig({}))).toEqual({
      requestedStacks: [],
      resolvedStacks: [],
      skills: [],
      mcpServers: [],
      profile: "balanced",
      targets: [],
    });
  });

  it("does not mutate the input configuration", () => {
    const config = parseAgnoxConfig({ extends: ["angular"], targets: ["codex"] });
    const snapshot = structuredClone(config);

    const resolved = resolveAgnoxConfig(config);

    expect(config).toEqual(snapshot);
    expect(resolved.requestedStacks).not.toBe(config.extends);
    expect(resolved.targets).not.toBe(config.targets);
  });

  it("accepts a custom registry", () => {
    const registry = createStackRegistry([{ name: "base" }, { name: "app", extends: ["base"] }]);

    expect(
      resolveAgnoxConfig(parseAgnoxConfig({ extends: ["app"] }), registry).resolvedStacks,
    ).toEqual(["base", "app"]);
  });

  it("accepts a custom skill registry", () => {
    const stacks = createStackRegistry([{ name: "app", skills: ["a"] }]);
    const skills = createSkillRegistry([
      { name: "a", load: () => ({ name: "a", description: "A.", content: "Do a." }) },
    ]);

    expect(
      resolveAgnoxConfig(parseAgnoxConfig({ extends: ["app"] }), stacks, skills).skills,
    ).toEqual(["a"]);
  });

  it("propagates unknown stacks", () => {
    expect(() => resolveAgnoxConfig(parseAgnoxConfig({ extends: ["svelte"] }))).toThrow(
      UnknownStackError,
    );
  });

  it("propagates unknown skills", () => {
    const registry = createStackRegistry([{ name: "app", skills: ["missing"] }]);

    expect(() => resolveAgnoxConfig(parseAgnoxConfig({ extends: ["app"] }), registry)).toThrow(
      UnknownSkillError,
    );
  });
});
