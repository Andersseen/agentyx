import { describe, expect, it } from "vitest";
import { CircularStackDependencyError, UnknownStackError } from "../src/stack/errors.js";
import { createStackRegistry } from "../src/stack/registry.js";
import { resolveStacks } from "../src/stack/resolver.js";

describe("resolveStacks", () => {
  it("resolves a root stack to itself", () => {
    expect(resolveStacks(["core"])).toEqual(["core"]);
  });

  it("resolves one level of inheritance dependency-first", () => {
    expect(resolveStacks(["typescript"])).toEqual(["core", "typescript"]);
  });

  it("resolves transitive inheritance", () => {
    expect(resolveStacks(["angular"])).toEqual(["core", "typescript", "angular"]);
  });

  it("removes duplicates when the same stack is requested twice", () => {
    expect(resolveStacks(["angular", "angular"])).toEqual(["core", "typescript", "angular"]);
  });

  it("removes duplicates when a requested stack is also inherited", () => {
    expect(resolveStacks(["typescript", "angular"])).toEqual(["core", "typescript", "angular"]);
  });

  it("is order-independent for stacks on the same inheritance chain", () => {
    expect(resolveStacks(["angular", "typescript"])).toEqual(
      resolveStacks(["typescript", "angular"]),
    );
  });

  it("resolves multiple independent roots in request order", () => {
    const registry = createStackRegistry([
      { name: "core" },
      { name: "typescript", extends: ["core"] },
      { name: "python", extends: ["core"] },
    ]);

    expect(resolveStacks(["typescript", "python"], registry)).toEqual([
      "core",
      "typescript",
      "python",
    ]);
    expect(resolveStacks(["python", "typescript"], registry)).toEqual([
      "core",
      "python",
      "typescript",
    ]);
  });

  it("resolves a diamond exactly once, dependency-first", () => {
    const registry = createStackRegistry([
      { name: "core" },
      { name: "left", extends: ["core"] },
      { name: "right", extends: ["core"] },
      { name: "app", extends: ["left", "right"] },
    ]);

    expect(resolveStacks(["app"], registry)).toEqual(["core", "left", "right", "app"]);
  });

  it("returns an empty list when nothing is requested", () => {
    expect(resolveStacks([])).toEqual([]);
  });

  it("returns a fresh array on every call", () => {
    const first = resolveStacks(["angular"]);
    const second = resolveStacks(["angular"]);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("rejects an unknown requested stack", () => {
    expect(() => resolveStacks(["svelte"])).toThrow(UnknownStackError);
    expect(() => resolveStacks(["svelte"])).toThrow(/Unknown stack "svelte"/);
    expect(() => resolveStacks(["svelte"])).toThrow(/angular, core, typescript/);
  });

  it("names the parent that referenced an unknown stack", () => {
    const registry = createStackRegistry([{ name: "angular", extends: ["typescript"] }]);

    try {
      resolveStacks(["angular"], registry);
      expect.unreachable("expected an UnknownStackError");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownStackError);
      const unknown = error as UnknownStackError;
      expect(unknown.stackName).toBe("typescript");
      expect(unknown.requiredBy).toBe("angular");
    }
  });

  it("rejects a circular dependency", () => {
    const registry = createStackRegistry([
      { name: "a", extends: ["b"] },
      { name: "b", extends: ["a"] },
    ]);

    try {
      resolveStacks(["a"], registry);
      expect.unreachable("expected a CircularStackDependencyError");
    } catch (error) {
      expect(error).toBeInstanceOf(CircularStackDependencyError);
      expect((error as CircularStackDependencyError).cycle).toEqual(["a", "b", "a"]);
    }
  });

  it("rejects a self-referencing stack", () => {
    const registry = createStackRegistry([{ name: "a", extends: ["a"] }]);

    expect(() => resolveStacks(["a"], registry)).toThrow(CircularStackDependencyError);
  });
});
