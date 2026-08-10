import { describe, expect, it } from "vitest";
import { mcpServerDefinitionSchema, mcpServerReferenceSchema } from "../src/mcp/schema.js";

describe("mcpServerDefinitionSchema", () => {
  it("accepts stdio servers", () => {
    expect(
      mcpServerDefinitionSchema.parse({
        name: "playwright",
        description: "Browser automation.",
        transport: "stdio",
        command: "npx",
        args: ["@playwright/mcp@latest"],
        env: { TOKEN: { fromEnv: "TOKEN" } },
      }),
    ).toMatchObject({ transport: "stdio", command: "npx" });
  });

  it("accepts HTTP servers", () => {
    expect(
      mcpServerDefinitionSchema.parse({
        name: "context7",
        description: "Docs.",
        transport: "http",
        url: "https://mcp.context7.com/mcp",
      }),
    ).toMatchObject({ transport: "http", headers: {} });
  });

  it("rejects invalid definitions", () => {
    expect(() =>
      mcpServerDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        transport: "pipe",
      }),
    ).toThrow();
    expect(() =>
      mcpServerDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        transport: "stdio",
        command: "",
      }),
    ).toThrow();
    expect(() =>
      mcpServerDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        transport: "http",
        url: "nope",
      }),
    ).toThrow();
    expect(() =>
      mcpServerDefinitionSchema.parse({
        name: "bad",
        description: "Bad.",
        transport: "stdio",
        command: "npx",
        env: { TOKEN: { fromEnv: "1_BAD" } },
      }),
    ).toThrow();
  });
});

describe("mcpServerReferenceSchema", () => {
  it("accepts explicit capability levels", () => {
    expect(mcpServerReferenceSchema.parse({ name: "context7", activation: "default" })).toEqual({
      name: "context7",
      activation: "default",
    });
  });

  it("keeps string references backward-compatible as recommended", () => {
    expect(mcpServerReferenceSchema.parse("context7")).toEqual({
      name: "context7",
      activation: "default",
    });
  });
});
