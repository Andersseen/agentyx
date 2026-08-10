import { describe, expect, it } from "vitest";
import { UnknownMcpServerError } from "../src/mcp/errors.js";
import { createMcpServerRegistry } from "../src/mcp/registry.js";
import {
  filterEffectiveMcpServers,
  resolvePackMcpServerReferences,
  resolvePackMcpServers,
} from "../src/mcp/resolver.js";
import { createPackRegistry } from "../src/pack/registry.js";

describe("resolvePackMcpServers", () => {
  it("collects MCP servers in selected pack order", () => {
    const packs = createPackRegistry([
      { name: "base", mcpServers: ["context7", "playwright"] },
      { name: "child", mcpServers: ["context7"] },
    ]);
    const mcps = createMcpServerRegistry([
      { name: "context7", load: () => valid("context7") },
      { name: "playwright", load: () => valid("playwright") },
    ]);

    expect(resolvePackMcpServers(["base", "child"], packs, mcps)).toEqual([
      "context7",
      "playwright",
    ]);
    expect(resolvePackMcpServerReferences(["base", "child"], packs, mcps)).toEqual([
      { name: "context7", activation: "default" },
      { name: "playwright", activation: "default" },
    ]);
  });

  it("fails clearly on unknown MCP references", () => {
    const packs = createPackRegistry([{ name: "base", mcpServers: ["missing"] }]);
    const mcps = createMcpServerRegistry([]);

    expect(() => resolvePackMcpServers(["base"], packs, mcps)).toThrow(UnknownMcpServerError);
  });

  it("filters effective MCP servers by enabled optional capabilities", () => {
    const declared = [
      { name: "default-server", activation: "default" as const },
      { name: "optional-server", activation: "optional" as const },
    ];

    expect(filterEffectiveMcpServers(declared, [])).toEqual(["default-server"]);
    expect(filterEffectiveMcpServers(declared, ["optional-server"])).toEqual([
      "default-server",
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
