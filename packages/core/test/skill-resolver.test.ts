import { describe, expect, it } from "vitest";
import { UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry } from "../src/skill/registry.js";
import { resolveStackSkills } from "../src/skill/resolver.js";
import { UnknownStackError } from "../src/stack/errors.js";
import { createStackRegistry } from "../src/stack/registry.js";

const skills = createSkillRegistry(
  ["a", "b", "c"].map((name) => ({
    name,
    load: () => ({ name, description: `The ${name} skill.`, content: `Do ${name}.` }),
  })),
);

describe("resolveStackSkills", () => {
  it("resolves the core skills", () => {
    expect(resolveStackSkills(["core"])).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
    ]);
  });

  it("resolves inherited skills before the stack's own", () => {
    expect(resolveStackSkills(["typescript"])).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
      "typescript-modern",
    ]);
  });

  it("resolves the full inherited chain", () => {
    expect(resolveStackSkills(["angular"])).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
      "typescript-modern",
      "angular-modern",
    ]);
  });

  it("returns no skills when nothing is requested", () => {
    expect(resolveStackSkills([])).toEqual([]);
  });

  it("returns a fresh array on every call", () => {
    const first = resolveStackSkills(["angular"]);
    const second = resolveStackSkills(["angular"]);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("preserves declaration order within a stack", () => {
    const stacks = createStackRegistry([{ name: "app", skills: ["c", "a", "b"] }]);

    expect(resolveStackSkills(["app"], stacks, skills)).toEqual(["c", "a", "b"]);
  });

  it("removes duplicates and keeps the first occurrence", () => {
    const stacks = createStackRegistry([
      { name: "base", skills: ["a", "b"] },
      { name: "app", extends: ["base"], skills: ["b", "c", "a"] },
    ]);

    expect(resolveStackSkills(["app"], stacks, skills)).toEqual(["a", "b", "c"]);
  });

  it("de-duplicates across independent stacks in resolution order", () => {
    const stacks = createStackRegistry([
      { name: "base", skills: ["a"] },
      { name: "left", extends: ["base"], skills: ["b"] },
      { name: "right", extends: ["base"], skills: ["b", "c"] },
    ]);

    expect(resolveStackSkills(["left", "right"], stacks, skills)).toEqual(["a", "b", "c"]);
  });

  it("skips stacks that contribute no skills", () => {
    const stacks = createStackRegistry([
      { name: "base" },
      { name: "app", extends: ["base"], skills: ["a"] },
    ]);

    expect(resolveStackSkills(["app"], stacks, skills)).toEqual(["a"]);
  });

  it("fails when a stack references an unknown skill", () => {
    const stacks = createStackRegistry([{ name: "app", skills: ["missing"] }]);

    try {
      resolveStackSkills(["app"], stacks, skills);
      expect.unreachable("expected an UnknownSkillError");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownSkillError);
      const unknown = error as UnknownSkillError;
      expect(unknown.skillName).toBe("missing");
      expect(unknown.requiredBy).toBe("app");
      expect(unknown.message).toBe(
        'Unknown skill "missing" (required by stack "app"). Known skills: a, b, c.',
      );
    }
  });

  it("propagates unknown stacks", () => {
    expect(() => resolveStackSkills(["svelte"])).toThrow(UnknownStackError);
  });
});
