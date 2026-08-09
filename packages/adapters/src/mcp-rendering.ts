import { resolve } from "node:path";
import type { McpServerDefinition } from "@agentyx/core";
import { parse, stringify } from "@iarna/toml";
import { ProviderConfigParseError } from "./errors.js";

export const CODEX_MCP_CONFIG_SEGMENTS = [".codex", "config.toml"] as const;
export const CLAUDE_MCP_CONFIG_SEGMENTS = [".mcp.json"] as const;
export const KIMI_MCP_CONFIG_SEGMENTS = [".kimi-code", "mcp.json"] as const;

type JsonRecord = Record<string, unknown>;

export function codexMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CODEX_MCP_CONFIG_SEGMENTS);
}

export function claudeMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CLAUDE_MCP_CONFIG_SEGMENTS);
}

export function kimiMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...KIMI_MCP_CONFIG_SEGMENTS);
}

export function renderCodexMcpConfig(
  servers: readonly McpServerDefinition[],
  existingContent: string | undefined,
): string {
  const config = parseTomlObject(existingContent, CODEX_MCP_CONFIG_SEGMENTS.join("/"));
  const mcpServers = optionalRecord(
    config.mcp_servers,
    CODEX_MCP_CONFIG_SEGMENTS.join("/"),
    "mcp_servers",
  );

  for (const server of servers) {
    mcpServers[server.name] = renderCodexMcpServer(server);
  }

  config.mcp_servers = sortRecord(mcpServers);

  return stringify(sortRecord(config) as never);
}

export function renderClaudeMcpConfig(
  servers: readonly McpServerDefinition[],
  existingContent: string | undefined,
): string {
  const config = parseJsonObject(existingContent, CLAUDE_MCP_CONFIG_SEGMENTS.join("/"));
  const mcpServers = optionalRecord(
    config.mcpServers,
    CLAUDE_MCP_CONFIG_SEGMENTS.join("/"),
    "mcpServers",
  );

  for (const server of servers) {
    mcpServers[server.name] = renderClaudeMcpServer(server);
  }

  config.mcpServers = sortRecord(mcpServers);

  return `${JSON.stringify(sortRecord(config), null, 2)}\n`;
}

export function renderKimiMcpConfig(
  servers: readonly McpServerDefinition[],
  existingContent: string | undefined,
): string {
  const config = parseJsonObject(existingContent, KIMI_MCP_CONFIG_SEGMENTS.join("/"));
  const mcpServers = optionalRecord(
    config.mcpServers,
    KIMI_MCP_CONFIG_SEGMENTS.join("/"),
    "mcpServers",
  );

  for (const server of servers) {
    mcpServers[server.name] = renderKimiMcpServer(server);
  }

  config.mcpServers = sortRecord(mcpServers);

  return `${JSON.stringify(sortRecord(config), null, 2)}\n`;
}

export function renderCodexMcpServer(server: McpServerDefinition): JsonRecord {
  if (server.transport === "stdio") {
    return {
      command: server.command,
      args: server.args,
      env: renderPlainEnv(server.env),
      enabled: true,
    };
  }

  const rendered: JsonRecord = {
    url: server.url,
    enabled: true,
  };
  const headers = renderPlainEnv(server.headers);

  if (Object.keys(headers).length > 0) {
    rendered.env_http_headers = headers;
  }

  return rendered;
}

export function renderClaudeMcpServer(server: McpServerDefinition): JsonRecord {
  if (server.transport === "stdio") {
    return {
      type: "stdio",
      command: server.command,
      args: server.args,
      env: renderExpandedEnv(server.env),
    };
  }

  const rendered: JsonRecord = {
    type: "http",
    url: server.url,
  };
  const headers = renderExpandedEnv(server.headers);

  if (Object.keys(headers).length > 0) {
    rendered.headers = headers;
  }

  return rendered;
}

export function renderKimiMcpServer(server: McpServerDefinition): JsonRecord {
  if (server.transport === "stdio") {
    return {
      command: server.command,
      args: server.args,
      env: renderPlainEnv(server.env),
    };
  }

  const rendered: JsonRecord = {
    url: server.url,
  };
  const headers = renderPlainEnv(server.headers);

  if (Object.keys(headers).length > 0) {
    rendered.headers = headers;
  }

  return rendered;
}

function renderExpandedEnv(env: Record<string, { fromEnv: string }>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, `\${${value.fromEnv}}`]),
  );
}

function renderPlainEnv(env: Record<string, { fromEnv: string }>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, value.fromEnv]),
  );
}

function parseJsonObject(content: string | undefined, path: string): JsonRecord {
  if (content === undefined) {
    return {};
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (!isRecord(parsed)) {
      throw new Error("expected a JSON object");
    }

    return parsed;
  } catch (cause) {
    throw new ProviderConfigParseError(path, cause);
  }
}

function parseTomlObject(content: string | undefined, path: string): JsonRecord {
  if (content === undefined) {
    return {};
  }

  try {
    return parse(content) as JsonRecord;
  } catch (cause) {
    throw new ProviderConfigParseError(path, cause);
  }
}

function optionalRecord(value: unknown, path: string, field: string): JsonRecord {
  if (value === undefined) {
    return {};
  }

  if (isRecord(value)) {
    return value;
  }

  throw new ProviderConfigParseError(path, new Error(`${field} must be an object`));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, isRecord(value) ? sortRecord(value) : value]),
  );
}
