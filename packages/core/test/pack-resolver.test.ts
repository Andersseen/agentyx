import { describe, expect, it } from "vitest";
import { UnknownPackError } from "../src/pack/errors.js";
import { builtInPackRegistry, createPackRegistry } from "../src/pack/registry.js";
import { resolvePacks } from "../src/pack/resolver.js";

describe("resolvePacks", () => {
  it("preserves configured order without hidden inheritance", () => {
    expect(resolvePacks(["technical", "typescript", "angular"])).toEqual([
      "technical",
      "typescript",
      "angular",
    ]);
    expect(resolvePacks(["angular"])).toEqual(["angular"]);
  });

  it("de-duplicates by first occurrence", () => {
    expect(resolvePacks(["typescript", "angular", "typescript"])).toEqual([
      "typescript",
      "angular",
    ]);
  });

  it("resolves an empty request to no packs", () => {
    expect(resolvePacks([])).toEqual([]);
  });

  it("composes cross-cutting packs with a stack without hidden inheritance", () => {
    expect(resolvePacks(["typescript", "testing", "security", "git"])).toEqual([
      "typescript",
      "testing",
      "security",
      "git",
    ]);
    expect(resolvePacks(["observability"])).toEqual(["observability"]);
  });

  it("uses the supplied registry", () => {
    const registry = createPackRegistry([{ name: "custom" }]);

    expect(resolvePacks(["custom"], registry)).toEqual(["custom"]);
  });

  it("throws for unknown packs", () => {
    expect(() => resolvePacks(["svelte"], builtInPackRegistry)).toThrow(UnknownPackError);
  });
});
