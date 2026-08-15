import { builtInMcpServerRegistry, mcpServerDefinitionSchema } from "@agentyx/core";
import { describe, expect, it } from "vitest";
import { ProviderConfigParseError } from "../src/errors.js";
import {
  renderClaudeMcpConfig,
  renderClaudeMcpServer,
  renderCodexMcpConfig,
  renderCodexMcpServer,
  renderKimiMcpConfig,
  renderKimiMcpServer,
} from "../src/mcp-rendering.js";

describe("MCP provider rendering", () => {
  it("renders one provider-independent definition for Codex, Claude and Kimi", () => {
    const context7 = builtInMcpServerRegistry.get("context7");
    const codexResult = renderCodexMcpServer(context7);
    const claudeResult = renderClaudeMcpServer(context7);
    const kimiResult = renderKimiMcpServer(context7);

    expect(context7).toBe(builtInMcpServerRegistry.get("context7"));
    expect(codexResult).toEqual({ enabled: true, url: "https://mcp.context7.com/mcp" });
    expect(claudeResult).toEqual({
      type: "http",
      url: "https://mcp.context7.com/mcp",
    });
    expect(kimiResult).toEqual({ url: "https://mcp.context7.com/mcp" });
  });

  it("renders stdio and env references without secret values", () => {
    const server = mcpServerDefinitionSchema.parse({
      name: "secure-docs",
      description: "Secure docs.",
      transport: "stdio",
      command: "npx",
      args: ["secure-docs"],
      env: { SECURE_TOKEN: { fromEnv: "SECURE_TOKEN" } },
    });

    expect(renderCodexMcpServer(server)).toMatchObject({
      command: "npx",
      env: { SECURE_TOKEN: "SECURE_TOKEN" },
    });
    expect(renderClaudeMcpServer(server)).toMatchObject({
      type: "stdio",
      command: "npx",
      env: { SECURE_TOKEN: `\${SECURE_TOKEN}` },
    });
    expect(renderKimiMcpServer(server)).toMatchObject({
      command: "npx",
      env: { SECURE_TOKEN: "SECURE_TOKEN" },
    });
  });

  it("preserves unrelated Codex TOML while adding and updating MCP entries", () => {
    const existing = [
      'model = "gpt-5"',
      "",
      "[mcp_servers.other]",
      'command = "other"',
      "args = []",
      "enabled = true",
      "",
    ].join("\n");

    const { content } = renderCodexMcpConfig([builtInMcpServerRegistry.get("context7")], {
      content: existing,
      remove: [],
    });

    expect(content).toContain('model = "gpt-5"');
    expect(content).toContain("[mcp_servers.other]");
    expect(content).toContain("[mcp_servers.context7]");
    expect(content).toContain('url = "https://mcp.context7.com/mcp"');
  });

  it("preserves unrelated Claude JSON while adding MCP entries", () => {
    const existing = JSON.stringify({
      custom: true,
      mcpServers: {
        other: { type: "stdio", command: "other", args: [] },
      },
    });

    const { content } = renderClaudeMcpConfig([builtInMcpServerRegistry.get("context7")], {
      content: existing,
      remove: [],
    });
    const parsed = JSON.parse(content);

    expect(parsed.custom).toBe(true);
    expect(parsed.mcpServers.other).toEqual({ type: "stdio", command: "other", args: [] });
    expect(parsed.mcpServers.context7).toEqual({
      type: "http",
      url: "https://mcp.context7.com/mcp",
    });
  });

  it("preserves unrelated Kimi JSON while adding MCP entries", () => {
    const existing = JSON.stringify({
      custom: true,
      mcpServers: {
        other: { command: "other", args: [] },
      },
    });

    const { content } = renderKimiMcpConfig([builtInMcpServerRegistry.get("context7")], {
      content: existing,
      remove: [],
    });
    const parsed = JSON.parse(content);

    expect(parsed.custom).toBe(true);
    expect(parsed.mcpServers.other).toEqual({ command: "other", args: [] });
    expect(parsed.mcpServers.context7).toEqual({
      url: "https://mcp.context7.com/mcp",
    });
  });

  it("does not silently repair malformed MCP sections", () => {
    expect(() =>
      renderCodexMcpConfig([builtInMcpServerRegistry.get("context7")], {
        content: "mcp_servers = []\n",
        remove: [],
      }),
    ).toThrow(ProviderConfigParseError);
    expect(() =>
      renderClaudeMcpConfig([builtInMcpServerRegistry.get("context7")], {
        content: JSON.stringify({ mcpServers: [] }),
        remove: [],
      }),
    ).toThrow(ProviderConfigParseError);
    expect(() =>
      renderKimiMcpConfig([builtInMcpServerRegistry.get("context7")], {
        content: JSON.stringify({ mcpServers: [] }),
        remove: [],
      }),
    ).toThrow(ProviderConfigParseError);
  });
});
