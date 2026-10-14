import { describe, expect, it } from "vitest";
import {
  builtInPackRegistry,
  explainAgentyxResolution,
  parseAgentyxConfig,
  resolutionExplanationEntrySchema,
  resolveAgentyxConfig,
} from "../src/index.js";
import { createPackRegistry } from "../src/pack/registry.js";

function explain(input: Record<string, unknown>, registry = builtInPackRegistry) {
  const resolved = resolveAgentyxConfig(parseAgentyxConfig(input), registry);

  return { resolved, entries: explainAgentyxResolution(resolved, registry) };
}

const find = (entries: ReturnType<typeof explain>["entries"], kind: string, name: string) =>
  entries.find((entry) => entry.kind === kind && entry.name === name);

describe("explainAgentyxResolution", () => {
  it("explains a default skill", () => {
    expect(find(explain({ packs: ["technical"] }).entries, "skill", "code-quality")).toEqual({
      kind: "skill",
      name: "code-quality",
      origins: [{ kind: "pack", name: "technical" }],
      activation: "default",
      active: true,
      reason: "default",
    });
  });

  it("keeps an optional capability visible while it is disabled", () => {
    const { resolved, entries } = explain({ packs: ["testing"] });

    expect(resolved.mcpServers).not.toContain("playwright");
    expect(find(entries, "mcp", "playwright")).toMatchObject({
      activation: "optional",
      active: false,
      reason: "optional-disabled",
      origins: [{ kind: "pack", name: "testing" }],
    });
  });

  it("identifies an explicitly enabled capability", () => {
    const { entries } = explain({ packs: ["testing"], enable: ["playwright"] });

    expect(find(entries, "mcp", "playwright")).toMatchObject({
      active: true,
      reason: "explicitly-enabled",
    });
  });

  it("explains the UI/UX pack and shared Playwright provenance", () => {
    const ui = explain({ packs: ["ui-ux"] });
    expect(ui.resolved.skills).toEqual([
      "ui-visual-design",
      "ux-usability",
      "interaction-design",
      "design-system-practice",
      "ux-writing",
      "visual-verification",
    ]);
    expect(find(ui.entries, "mcp", "playwright")).toMatchObject({
      active: false,
      reason: "optional-disabled",
      origins: [{ kind: "pack", name: "ui-ux" }],
    });

    const combined = explain({ packs: ["ui-ux", "testing"], enable: ["playwright"] });
    expect(
      combined.entries.filter((entry) => entry.kind === "mcp" && entry.name === "playwright"),
    ).toHaveLength(1);
    expect(find(combined.entries, "mcp", "playwright")).toMatchObject({
      active: true,
      reason: "explicitly-enabled",
      origins: [
        { kind: "pack", name: "ui-ux" },
        { kind: "pack", name: "testing" },
      ],
    });
  });

  it("lists a shared capability once with every pack in resolution order", () => {
    const { entries } = explain({ packs: ["performance", "accessibility"] });
    const devtools = entries.filter((entry) => entry.name === "chrome-devtools");

    expect(devtools).toHaveLength(1);
    expect(devtools[0]?.origins).toEqual([
      { kind: "pack", name: "performance" },
      { kind: "pack", name: "accessibility" },
    ]);
    expect(
      explain({ packs: ["accessibility", "performance"] }).entries.find(
        (entry) => entry.name === "chrome-devtools",
      )?.origins,
    ).toEqual([
      { kind: "pack", name: "accessibility" },
      { kind: "pack", name: "performance" },
    ]);
  });

  it("treats a capability as default when any contributing pack declares it default", () => {
    const registry = createPackRegistry([
      { name: "a", mcpServers: [{ name: "playwright", activation: "optional" }] },
      { name: "b", mcpServers: [{ name: "playwright", activation: "default" }] },
    ]);
    const { resolved, entries } = explain({ packs: ["a", "b"] }, registry);

    expect(resolved.mcpServers).toEqual(["playwright"]);
    expect(find(entries, "mcp", "playwright")).toMatchObject({
      activation: "default",
      active: true,
      reason: "default",
      origins: [
        { kind: "pack", name: "a" },
        { kind: "pack", name: "b" },
      ],
    });
  });

  it("explains agents, enabled or not", () => {
    const off = explain({ packs: ["agentic"] }).entries;
    const on = explain({ packs: ["agentic"], enable: ["agentyx-reviewer"] }).entries;

    expect(find(off, "agent", "agentyx-reviewer")).toMatchObject({
      active: false,
      reason: "optional-disabled",
      origins: [{ kind: "pack", name: "agentic" }],
    });
    expect(find(on, "agent", "agentyx-reviewer")).toMatchObject({
      activation: "optional",
      active: true,
      reason: "explicitly-enabled",
    });
  });

  it("attributes the project-context skill to project context, not a pack", () => {
    const { entries } = explain({ packs: ["technical"], project: { id: "web", name: "Web" } });

    expect(find(entries, "skill", "agentyx-project-context")).toEqual({
      kind: "skill",
      name: "agentyx-project-context",
      origins: [{ kind: "project-context" }],
      activation: "default",
      active: true,
      reason: "project-context",
    });
    expect(
      find(explain({ packs: ["technical"] }).entries, "skill", "agentyx-project-context"),
    ).toBe(undefined);
  });

  it("uses the project's own pack registry for local packs", () => {
    const registry = createPackRegistry([
      {
        name: "rust-entwine",
        skills: ["code-quality"],
        tools: [{ name: "rtk", activation: "optional" }],
      },
    ]);
    const { entries } = explain({ packs: ["rust-entwine"] }, registry);

    expect(find(entries, "skill", "code-quality")?.origins).toEqual([
      { kind: "pack", name: "rust-entwine" },
    ]);
    expect(find(entries, "tool", "rtk")).toMatchObject({
      active: false,
      reason: "optional-disabled",
    });
  });

  it("orders capabilities by first contribution and lists each origin once", () => {
    const registry = createPackRegistry([
      { name: "a", skills: ["code-quality", "api-design"] },
      { name: "b", skills: ["code-review", "code-quality"] },
    ]);
    const skills = explain({ packs: ["a", "b", "a"] }, registry).entries.filter(
      (entry) => entry.kind === "skill",
    );

    expect(skills.map((entry) => entry.name)).toEqual([
      "code-quality",
      "api-design",
      "code-review",
    ]);
    expect(skills[0]?.origins).toEqual([
      { kind: "pack", name: "a" },
      { kind: "pack", name: "b" },
    ]);
  });

  it("emits only identifiers and selection metadata", () => {
    const { entries } = explain({ packs: ["agentic", "testing", "efficiency"] });

    for (const entry of entries) {
      expect(() => resolutionExplanationEntrySchema.parse(entry)).not.toThrow();
    }
  });
});
