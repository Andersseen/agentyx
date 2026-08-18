import { describe, expect, it } from "vitest";
import {
  builtInMcpServerRegistry,
  createMcpServerRegistry,
  DuplicateMcpServerError,
  UnknownMcpServerError,
} from "../src/index.js";

describe("builtInMcpServerRegistry", () => {
  it("lists the built-in MCP servers", () => {
    expect(builtInMcpServerRegistry.names).toEqual([
      "context7",
      "playwright",
      "codebase-memory",
      "github",
      "sentry",
      "chrome-devtools",
      "supabase",
    ]);
  });

  it("retrieves known MCP servers and metadata", () => {
    expect(builtInMcpServerRegistry.get("context7")).toMatchObject({
      name: "context7",
      transport: "http",
      contextCost: "medium",
    });
    expect(builtInMcpServerRegistry.listMetadata()).toEqual([
      {
        name: "context7",
        description: "Fetch up-to-date library documentation from Context7.",
        transport: "http",
        contextCost: "medium",
      },
      {
        name: "playwright",
        description: "Automate and inspect browsers through Playwright MCP.",
        transport: "stdio",
        contextCost: "high",
      },
      {
        name: "codebase-memory",
        description:
          "Structural code-intelligence MCP backed by a persistent code knowledge graph.",
        transport: "stdio",
        contextCost: "high",
      },
      {
        name: "github",
        description: "Read repositories, issues, pull requests and workflow runs on GitHub.",
        transport: "http",
        contextCost: "high",
      },
      {
        name: "sentry",
        description: "Inspect production issues, events and stack traces recorded by Sentry.",
        transport: "http",
        contextCost: "medium",
      },
      {
        name: "chrome-devtools",
        description: "Record performance traces and inspect pages through Chrome DevTools.",
        transport: "stdio",
        contextCost: "high",
      },
      {
        name: "supabase",
        description: "Inspect and query Supabase project schemas, tables and logs.",
        transport: "stdio",
        contextCost: "high",
      },
    ]);
  });

  it("fails on unknown and duplicate MCP servers", () => {
    expect(() => builtInMcpServerRegistry.get("nope")).toThrow(UnknownMcpServerError);
    expect(() =>
      createMcpServerRegistry([
        { name: "dupe", load: () => valid("dupe") },
        { name: "dupe", load: () => valid("dupe") },
      ]),
    ).toThrow(DuplicateMcpServerError);
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
