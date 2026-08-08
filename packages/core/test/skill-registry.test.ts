import { describe, expect, it, vi } from "vitest";
import { DuplicateSkillError, InvalidSkillError, UnknownSkillError } from "../src/skill/errors.js";
import { createSkillRegistry, type SkillSource } from "../src/skill/registry.js";
import type { SkillDefinitionInput } from "../src/skill/schema.js";

function source(name: string, definition?: Partial<SkillDefinitionInput>): SkillSource {
  return {
    name,
    load: () => ({
      name,
      description: `The ${name} skill.`,
      content: `Do ${name}.`,
      ...definition,
    }),
  };
}

describe("createSkillRegistry", () => {
  it("lists names in registration order", () => {
    expect(createSkillRegistry([source("b"), source("a")]).names).toEqual(["b", "a"]);
  });

  it("reports existence without loading", () => {
    const load = vi.fn(() => ({ name: "a", description: "A.", content: "Do a." }));
    const registry = createSkillRegistry([{ name: "a", load }]);

    expect(registry.has("a")).toBe(true);
    expect(registry.has("b")).toBe(false);
    expect(registry.names).toEqual(["a"]);
    expect(load).not.toHaveBeenCalled();
  });

  it("returns a known skill", () => {
    expect(createSkillRegistry([source("planning")]).get("planning")).toEqual({
      name: "planning",
      description: "The planning skill.",
      content: "Do planning.",
    });
  });

  it("loads each skill at most once", () => {
    const load = vi.fn(() => ({ name: "a", description: "A.", content: "Do a." }));
    const registry = createSkillRegistry([{ name: "a", load }]);

    expect(registry.get("a")).toBe(registry.get("a"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("fails on an unknown skill", () => {
    const registry = createSkillRegistry([source("a"), source("b")]);

    expect(() => registry.get("c")).toThrow(UnknownSkillError);
    expect(() => registry.get("c")).toThrow(/Unknown skill "c"\. Known skills: a, b\./);
  });

  it("rejects duplicate skill names", () => {
    expect(() => createSkillRegistry([source("a"), source("a")])).toThrow(DuplicateSkillError);
  });

  it("rejects an invalid source name at construction", () => {
    expect(() => createSkillRegistry([source("Not A Slug")])).toThrow(InvalidSkillError);
  });

  it("rejects an invalid definition when it is loaded", () => {
    const registry = createSkillRegistry([source("a", { description: "" })]);

    expect(registry.has("a")).toBe(true);
    expect(() => registry.get("a")).toThrow(InvalidSkillError);
  });

  it("rejects a definition whose name does not match its source", () => {
    const registry = createSkillRegistry([source("a", { name: "b" })]);

    expect(() => registry.get("a")).toThrow(/it declares the name "b"/);
  });

  it("builds an empty registry", () => {
    const registry = createSkillRegistry([]);

    expect(registry.names).toEqual([]);
    expect(registry.has("a")).toBe(false);
  });
});
