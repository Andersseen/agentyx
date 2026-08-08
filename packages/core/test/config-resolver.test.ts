import { describe, expect, it } from "vitest";
import { parseAgnoxConfig } from "../src/config/loader.js";
import { resolveAgnoxConfig } from "../src/config/resolver.js";
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
      profile: "balanced",
      targets: ["codex"],
    });
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

  it("propagates unknown stacks", () => {
    expect(() => resolveAgnoxConfig(parseAgnoxConfig({ extends: ["svelte"] }))).toThrow(
      UnknownStackError,
    );
  });
});
