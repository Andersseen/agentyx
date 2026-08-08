import { describe, expect, it } from "vitest";
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
});

describe("createStackRegistry", () => {
  it("applies the empty extends default", () => {
    const registry = createStackRegistry([{ name: "solo" }]);

    expect(registry.get("solo")).toEqual({ name: "solo", extends: [] });
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
    expect(() => createStackRegistry([{ name: "core", skills: ["a"] } as never])).toThrow();
  });
});
