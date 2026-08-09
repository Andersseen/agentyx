import { UnknownMcpServerError } from "@agnox/core";
import { describe, expect, it } from "vitest";
import { createMcpCommand, runMcpListCommand, runMcpShowCommand } from "../src/commands/mcp.js";
import { createAgnoxProgram } from "../src/index.js";

describe("agnox mcp list", () => {
  it("lists built-in MCP server identifiers", () => {
    expect(runMcpListCommand()).toBe(["context7", "playwright"].join("\n"));
  });
});

describe("agnox mcp show", () => {
  it("shows HTTP MCP server data without secrets", () => {
    expect(runMcpShowCommand({ name: "context7", json: false })).toBe(
      [
        "context7",
        "Fetch up-to-date library documentation from Context7.",
        "transport: http",
        "context cost: medium",
        "url: https://mcp.context7.com/mcp",
        "required environment",
        "  (none)",
      ].join("\n"),
    );
  });

  it("shows stdio MCP server data", () => {
    const output = runMcpShowCommand({ name: "playwright", json: false });

    expect(output).toContain("transport: stdio");
    expect(output).toContain("context cost: high");
    expect(output).toContain("command: npx");
    expect(output).toContain("  @playwright/mcp@latest");
  });

  it("prints JSON", () => {
    expect(JSON.parse(runMcpShowCommand({ name: "context7", json: true }))).toEqual({
      name: "context7",
      description: "Fetch up-to-date library documentation from Context7.",
      transport: "http",
      contextCost: "medium",
      url: "https://mcp.context7.com/mcp",
      headers: {},
    });
  });

  it("fails cleanly for unknown MCP servers", () => {
    expect(() => runMcpShowCommand({ name: "nope", json: false })).toThrow(UnknownMcpServerError);
  });
});

describe("mcp command wiring", () => {
  it("declares list and show", () => {
    expect(createMcpCommand().commands.map((command) => command.name())).toEqual(["list", "show"]);
  });

  it("is registered on the agnox program", () => {
    expect(createAgnoxProgram().commands.map((command) => command.name())).toContain("mcp");
  });
});
