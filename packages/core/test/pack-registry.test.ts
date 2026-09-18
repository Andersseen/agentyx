import { describe, expect, it } from "vitest";
import { builtInHookRegistry } from "../src/hook/built-in.js";
import { builtInMcpServerRegistry } from "../src/mcp/built-in.js";
import { DuplicatePackError } from "../src/pack/errors.js";
import { builtInPackRegistry, builtInPacks, createPackRegistry } from "../src/pack/registry.js";
import { PACK_CATEGORIES } from "../src/pack/schema.js";
import { builtInSkillRegistry } from "../src/skill/built-in.js";
import { builtInToolRegistry } from "../src/tool/built-in.js";

describe("built-in pack registry", () => {
  it("ships exactly the documented packs", () => {
    expect([...builtInPackRegistry.keys()]).toEqual([
      "technical",
      "typescript",
      "angular",
      "efficiency",
      "agentic",
      "testing",
      "security",
      "performance",
      "accessibility",
      "refactoring",
      "documentation",
      "observability",
      "data",
      "git",
      "devops",
    ]);
  });

  it("categorizes every built-in pack", () => {
    for (const pack of builtInPackRegistry.values()) {
      expect(PACK_CATEGORIES, `${pack.name} has category ${pack.category}`).toContain(
        pack.category,
      );
    }
  });

  it("describes every built-in pack", () => {
    for (const pack of builtInPacks) {
      expect(pack.description).toBeTruthy();
    }
  });

  /**
   * A description explains what the pack is for, not how great it is. This is a light heuristic,
   * not a style linter: it catches the obvious failure mode (marketing copy pasted into product
   * data) without policing prose.
   */
  it("keeps pack descriptions purpose-focused rather than promotional", () => {
    const marketingWords =
      /\b(amazing|revolutionary|best[- ]in[- ]class|game[- ]changing|cutting[- ]edge|world[- ]class)\b/i;

    for (const pack of builtInPackRegistry.values()) {
      const description = pack.description ?? "";

      expect(
        description.length,
        `${pack.name} description is too short to be meaningful`,
      ).toBeGreaterThan(15);
      expect(description, `${pack.name} description reads as marketing copy`).not.toMatch(
        marketingWords,
      );
      expect(description, `${pack.name} description should not shout`).not.toMatch(/!/);
    }
  });

  it("only references hooks the built-in hook registry provides", () => {
    for (const pack of builtInPackRegistry.values()) {
      for (const hook of pack.hooks) {
        expect(builtInHookRegistry.has(hook.name), `${pack.name} references ${hook.name}`).toBe(
          true,
        );
      }
    }
  });

  it("names an optional capability in exactly one activation, never both default and optional", () => {
    for (const pack of builtInPackRegistry.values()) {
      for (const kind of ["mcpServers", "tools", "hooks"] as const) {
        const activations = new Map<string, string>();

        for (const reference of pack[kind]) {
          const existing = activations.get(reference.name);

          expect(
            existing === undefined || existing === reference.activation,
            `${pack.name} declares ${reference.name} as both ${existing} and ${reference.activation}`,
          ).toBe(true);
          activations.set(reference.name, reference.activation);
        }
      }
    }
  });

  it("declares the documented skills", () => {
    expect(builtInPackRegistry.get("technical")?.skills).toEqual([
      "engineering-principles",
      "code-quality",
      "api-design",
      "code-review",
    ]);
    expect(builtInPackRegistry.get("typescript")?.skills).toEqual([
      "typescript-strict",
      "typescript-modeling",
      "typescript-modern",
    ]);
    expect(builtInPackRegistry.get("angular")?.skills).toEqual([
      "angular-modern",
      "angular-signals",
      "angular-architecture",
      "angular-testing",
    ]);
  });

  it("only references skills the built-in skill registry provides", () => {
    for (const pack of builtInPackRegistry.values()) {
      for (const skill of pack.skills) {
        expect(builtInSkillRegistry.has(skill), `${pack.name} references ${skill}`).toBe(true);
      }
    }
  });

  it("only references MCP servers the built-in MCP registry provides", () => {
    for (const pack of builtInPackRegistry.values()) {
      for (const server of pack.mcpServers) {
        expect(
          builtInMcpServerRegistry.has(server.name),
          `${pack.name} references ${server.name}`,
        ).toBe(true);
      }
    }
  });

  it("only references tools the built-in tool registry provides", () => {
    for (const pack of builtInPackRegistry.values()) {
      for (const tool of pack.tools) {
        expect(builtInToolRegistry.has(tool.name), `${pack.name} references ${tool.name}`).toBe(
          true,
        );
      }
    }
  });
});

describe("createPackRegistry", () => {
  it("applies empty capability defaults", () => {
    const registry = createPackRegistry([{ name: "solo" }]);

    expect(registry.get("solo")).toEqual({
      name: "solo",
      category: "engineering",
      skills: [],
      mcpServers: [],
      tools: [],
      hooks: [],
    });
  });

  it("normalizes string MCP references to recommended", () => {
    const registry = createPackRegistry([{ name: "solo", mcpServers: ["context7"] }]);

    expect(registry.get("solo")?.mcpServers).toEqual([{ name: "context7", activation: "default" }]);
  });

  it("keeps declared skills in order", () => {
    const registry = createPackRegistry([{ name: "solo", skills: ["b", "a"] }]);

    expect(registry.get("solo")?.skills).toEqual(["b", "a"]);
  });

  it("rejects a skill name that is not a lowercase slug", () => {
    expect(() => createPackRegistry([{ name: "solo", skills: ["Not A Slug"] }])).toThrow();
  });

  it("rejects duplicate pack names", () => {
    expect(() => createPackRegistry([{ name: "core" }, { name: "core" }])).toThrow(
      DuplicatePackError,
    );
  });

  it("rejects definitions with an empty name", () => {
    expect(() => createPackRegistry([{ name: "" }])).toThrow();
  });

  it("rejects unknown definition fields", () => {
    expect(() => createPackRegistry([{ name: "core", targets: ["codex"] } as never])).toThrow();
  });
});
