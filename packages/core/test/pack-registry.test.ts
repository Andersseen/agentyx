import { describe, expect, it } from "vitest";
import { builtInMcpServerRegistry } from "../src/mcp/built-in.js";
import { DuplicatePackError } from "../src/pack/errors.js";
import { builtInPackRegistry, builtInPacks, createPackRegistry } from "../src/pack/registry.js";
import { builtInSkillRegistry } from "../src/skill/built-in.js";
import { builtInToolRegistry } from "../src/tool/built-in.js";

describe("built-in pack registry", () => {
  it("ships exactly the first five packs", () => {
    expect([...builtInPackRegistry.keys()]).toEqual([
      "technical",
      "typescript",
      "angular",
      "efficiency",
      "agentic",
    ]);
  });

  it("describes every built-in pack", () => {
    for (const pack of builtInPacks) {
      expect(pack.description).toBeTruthy();
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
