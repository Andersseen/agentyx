import { describe, expect, it } from "vitest";
import { UnknownMcpServerError } from "../src/mcp/errors.js";
import { createMcpServerRegistry } from "../src/mcp/registry.js";
import {
  filterEffectiveMcpServers,
  resolveStackMcpServerReferences,
  resolveStackMcpServers,
} from "../src/mcp/resolver.js";
import { createStackRegistry } from "../src/stack/registry.js";

describe("resolveStackMcpServers", () => {
  it("collects inherited MCP servers in deterministic dependency-first order", () => {
    const stacks = createStackRegistry([
      { name: "base", mcpServers: ["context7", "playwright"] },
      { name: "child", extends: ["base"], mcpServers: ["context7"] },
    ]);
    const mcps = createMcpServerRegistry([
      { name: "context7", load: () => valid("context7") },
      { name: "playwright", load: () => valid("playwright") },
    ]);

    expect(resolveStackMcpServers(["child"], stacks, mcps)).toEqual(["context7", "playwright"]);
    expect(resolveStackMcpServerReferences(["child"], stacks, mcps)).toEqual([
      { name: "context7", level: "recommended" },
      { name: "playwright", level: "recommended" },
    ]);
  });

  it("fails clearly on unknown MCP references", () => {
    const stacks = createStackRegistry([{ name: "base", mcpServers: ["missing"] }]);
    const mcps = createMcpServerRegistry([]);

    expect(() => resolveStackMcpServers(["base"], stacks, mcps)).toThrow(UnknownMcpServerError);
  });

  it("filters effective MCP servers by optimization profile", () => {
    const declared = [
      { name: "essential-server", level: "essential" as const },
      { name: "recommended-server", level: "recommended" as const },
      { name: "optional-server", level: "optional" as const },
    ];

    expect(filterEffectiveMcpServers(declared, "lean")).toEqual(["essential-server"]);
    expect(filterEffectiveMcpServers(declared, "balanced")).toEqual([
      "essential-server",
      "recommended-server",
    ]);
    expect(filterEffectiveMcpServers(declared, "autonomous")).toEqual([
      "essential-server",
      "recommended-server",
      "optional-server",
    ]);
  });
});

function valid(name: string) {
  return {
    name,
    description: "Test.",
    transport: "http" as const,
    url: "https://example.com/mcp",
  };
}
