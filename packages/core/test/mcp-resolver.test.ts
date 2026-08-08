import { describe, expect, it } from "vitest";
import { UnknownMcpServerError } from "../src/mcp/errors.js";
import { createMcpServerRegistry } from "../src/mcp/registry.js";
import { resolveStackMcpServers } from "../src/mcp/resolver.js";
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
  });

  it("fails clearly on unknown MCP references", () => {
    const stacks = createStackRegistry([{ name: "base", mcpServers: ["missing"] }]);
    const mcps = createMcpServerRegistry([]);

    expect(() => resolveStackMcpServers(["base"], stacks, mcps)).toThrow(UnknownMcpServerError);
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
