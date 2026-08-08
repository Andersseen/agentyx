import { describe, expect, it } from "vitest";
import { builtInSkillRegistry } from "../src/skill/built-in.js";
import { DuplicateStackError } from "../src/stack/errors.js";
import { builtInStackRegistry, builtInStacks, createStackRegistry } from "../src/stack/registry.js";

describe("built-in stack registry", () => {
  it("ships exactly core, typescript and angular", () => {
    expect([...builtInStackRegistry.keys()]).toEqual(["core", "typescript", "angular"]);
  });

  it("declares the documented inheritance relationships", () => {
    expect(builtInStackRegistry.get("core")?.extends).toEqual([]);
    expect(builtInStackRegistry.get("typescript")?.extends).toEqual(["core"]);
    expect(builtInStackRegistry.get("angular")?.extends).toEqual(["typescript"]);
  });

  it("describes every built-in stack", () => {
    for (const stack of builtInStacks) {
      expect(stack.description).toBeTruthy();
    }
  });

  it("declares the documented skills", () => {
    expect(builtInStackRegistry.get("core")?.skills).toEqual([
      "planning",
      "systematic-debugging",
      "verification",
    ]);
    expect(builtInStackRegistry.get("typescript")?.skills).toEqual(["typescript-modern"]);
    expect(builtInStackRegistry.get("angular")?.skills).toEqual(["angular-modern"]);
  });

  it("only references skills the built-in skill registry provides", () => {
    for (const stack of builtInStackRegistry.values()) {
      for (const skill of stack.skills) {
        expect(builtInSkillRegistry.has(skill), `${stack.name} references ${skill}`).toBe(true);
      }
    }
  });
});

describe("createStackRegistry", () => {
  it("applies the empty extends and skills defaults", () => {
    const registry = createStackRegistry([{ name: "solo" }]);

    expect(registry.get("solo")).toEqual({ name: "solo", extends: [], skills: [] });
  });

  it("keeps declared skills in order", () => {
    const registry = createStackRegistry([{ name: "solo", skills: ["b", "a"] }]);

    expect(registry.get("solo")?.skills).toEqual(["b", "a"]);
  });

  it("rejects a skill name that is not a lowercase slug", () => {
    expect(() => createStackRegistry([{ name: "solo", skills: ["Not A Slug"] }])).toThrow();
  });

  it("rejects duplicate stack names", () => {
    expect(() => createStackRegistry([{ name: "core" }, { name: "core" }])).toThrow(
      DuplicateStackError,
    );
  });

  it("rejects definitions with an empty name", () => {
    expect(() => createStackRegistry([{ name: "" }])).toThrow();
  });

  it("rejects unknown definition fields", () => {
    expect(() => createStackRegistry([{ name: "core", targets: ["codex"] } as never])).toThrow();
  });
});
