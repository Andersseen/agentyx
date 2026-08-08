import { describe, expect, it } from "vitest";
import {
  builtInMcpServerRegistry,
  createMcpServerRegistry,
  DuplicateMcpServerError,
  UnknownMcpServerError,
} from "../src/index.js";

describe("builtInMcpServerRegistry", () => {
  it("lists the built-in MCP servers", () => {
    expect(builtInMcpServerRegistry.names).toEqual(["context7", "playwright"]);
  });

  it("retrieves known MCP servers and metadata", () => {
    expect(builtInMcpServerRegistry.get("context7")).toMatchObject({
      name: "context7",
      transport: "http",
    });
    expect(builtInMcpServerRegistry.listMetadata()).toEqual([
      {
        name: "context7",
        description: "Fetch up-to-date library documentation from Context7.",
        transport: "http",
      },
      {
        name: "playwright",
        description: "Automate and inspect browsers through Playwright MCP.",
        transport: "stdio",
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
