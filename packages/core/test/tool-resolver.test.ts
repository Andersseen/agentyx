import { describe, expect, it } from "vitest";
import { createPackRegistry } from "../src/pack/registry.js";
import { UnknownToolError } from "../src/tool/errors.js";
import { createToolRegistry } from "../src/tool/registry.js";
import {
  collectPackToolReferences,
  filterEffectiveTools,
  resolvePackToolReferences,
  resolvePackTools,
} from "../src/tool/resolver.js";

const tools = createToolRegistry(
  ["a", "b", "c"].map((name) => ({
    name,
    load: () => ({
      name,
      description: `The ${name} tool.`,
      kind: "executable" as const,
      command: name,
    }),
  })),
);

describe("collectPackToolReferences", () => {
  it("collects declared references in pack order", () => {
    const packs = createPackRegistry([
      { name: "left", tools: ["a"] },
      { name: "right", tools: [{ name: "b", activation: "optional" }] },
    ]);

    expect(collectPackToolReferences(["left", "right"], packs, tools)).toEqual([
      { name: "a", activation: "default" },
      { name: "b", activation: "optional" },
    ]);
  });

  it("keeps the first occurrence of a repeated tool", () => {
    const packs = createPackRegistry([
      { name: "left", tools: [{ name: "a", activation: "optional" }] },
      { name: "right", tools: ["a", "b"] },
    ]);

    expect(collectPackToolReferences(["left", "right"], packs, tools)).toEqual([
      { name: "a", activation: "optional" },
      { name: "b", activation: "default" },
    ]);
  });

  it("ignores packs that are absent from the registry", () => {
    const packs = createPackRegistry([{ name: "left", tools: ["a"] }]);

    expect(collectPackToolReferences(["left", "ghost"], packs, tools)).toEqual([
      { name: "a", activation: "default" },
    ]);
  });

  it("throws when a pack references an unregistered tool", () => {
    const packs = createPackRegistry([{ name: "left", tools: ["z"] }]);

    expect(() => collectPackToolReferences(["left"], packs, tools)).toThrow(UnknownToolError);
    expect(() => collectPackToolReferences(["left"], packs, tools)).toThrow(/required by "left"/);
  });
});

describe("filterEffectiveTools", () => {
  const declared = [
    { name: "a", activation: "default" as const },
    { name: "b", activation: "optional" as const },
  ];

  it("keeps default tools and drops optional ones", () => {
    expect(filterEffectiveTools(declared, [])).toEqual(["a"]);
  });

  it("includes an optional tool once enabled", () => {
    expect(filterEffectiveTools(declared, ["b"])).toEqual(["a", "b"]);
  });

  it("ignores enabled names that were never declared", () => {
    expect(filterEffectiveTools(declared, ["c"])).toEqual(["a"]);
  });
});

describe("resolvePackToolReferences", () => {
  it("validates the requested packs before collecting", () => {
    const packs = createPackRegistry([{ name: "left", tools: ["a"] }]);

    expect(() => resolvePackToolReferences(["ghost"], packs, tools)).toThrow(/Unknown pack/);
  });
});

describe("resolvePackTools", () => {
  it("resolves the built-in efficiency pack", () => {
    expect(resolvePackTools(["efficiency"])).toEqual([]);
    expect(resolvePackTools(["efficiency"], undefined, undefined, ["rtk"])).toEqual(["rtk"]);
  });

  it("returns no tools for a pack that declares none", () => {
    expect(resolvePackTools(["technical"])).toEqual([]);
  });
});
