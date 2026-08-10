import { describe, expect, it } from "vitest";
import { UnknownPackError } from "../src/pack/errors.js";
import { createPackRegistry } from "../src/pack/registry.js";
import { UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry } from "../src/skill/registry.js";
import { resolvePackSkills } from "../src/skill/resolver.js";

const skills = createSkillRegistry(
  ["a", "b", "c"].map((name) => ({
    name,
    load: () => ({ name, description: `The ${name} skill.`, content: `Do ${name}.` }),
  })),
);

describe("resolvePackSkills", () => {
  it("resolves technical skills", () => {
    expect(resolvePackSkills(["technical"])).toEqual([
      "engineering-principles",
      "code-quality",
      "api-design",
      "code-review",
    ]);
  });

  it("resolves TypeScript skills without hidden technical skills", () => {
    expect(resolvePackSkills(["typescript"])).toEqual([
      "typescript-strict",
      "typescript-modeling",
      "typescript-modern",
    ]);
  });

  it("resolves selected packs in order", () => {
    expect(resolvePackSkills(["technical", "typescript", "angular"])).toEqual([
      "engineering-principles",
      "code-quality",
      "api-design",
      "code-review",
      "typescript-strict",
      "typescript-modeling",
      "typescript-modern",
      "angular-modern",
      "angular-signals",
      "angular-architecture",
      "angular-testing",
    ]);
  });

  it("returns no skills when nothing is requested", () => {
    expect(resolvePackSkills([])).toEqual([]);
  });

  it("returns a fresh array on every call", () => {
    const first = resolvePackSkills(["technical", "typescript", "angular"]);
    const second = resolvePackSkills(["technical", "typescript", "angular"]);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("preserves declaration order within a pack", () => {
    const packs = createPackRegistry([{ name: "app", skills: ["c", "a", "b"] }]);

    expect(resolvePackSkills(["app"], packs, skills)).toEqual(["c", "a", "b"]);
  });

  it("removes duplicates and keeps the first occurrence", () => {
    const packs = createPackRegistry([
      { name: "base", skills: ["a", "b"] },
      { name: "app", skills: ["b", "c", "a"] },
    ]);

    expect(resolvePackSkills(["base", "app"], packs, skills)).toEqual(["a", "b", "c"]);
  });

  it("de-duplicates across independent packs in resolution order", () => {
    const packs = createPackRegistry([
      { name: "base", skills: ["a"] },
      { name: "left", skills: ["b"] },
      { name: "right", skills: ["b", "c"] },
    ]);

    expect(resolvePackSkills(["base", "left", "right"], packs, skills)).toEqual(["a", "b", "c"]);
  });

  it("skips packs that contribute no skills", () => {
    const packs = createPackRegistry([{ name: "base" }, { name: "app", skills: ["a"] }]);

    expect(resolvePackSkills(["app"], packs, skills)).toEqual(["a"]);
  });

  it("fails when a pack references an unknown skill", () => {
    const packs = createPackRegistry([{ name: "app", skills: ["missing"] }]);

    try {
      resolvePackSkills(["app"], packs, skills);
      expect.unreachable("expected an UnknownSkillError");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownSkillError);
      const unknown = error as UnknownSkillError;
      expect(unknown.skillName).toBe("missing");
      expect(unknown.requiredBy).toBe("app");
      expect(unknown.message).toBe(
        'Unknown skill "missing" (required by pack "app"). Known skills: a, b, c.',
      );
    }
  });

  it("propagates unknown packs", () => {
    expect(() => resolvePackSkills(["svelte"])).toThrow(UnknownPackError);
  });
});
