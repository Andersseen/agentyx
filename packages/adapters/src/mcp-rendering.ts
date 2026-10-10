import { resolve } from "node:path";
import type { McpServerDefinition } from "@agentyx/core";
import { parse, stringify } from "@iarna/toml";
import type { ExistingMcpConfig } from "./adapter.js";
import { ProviderConfigParseError, UnsupportedMcpEnvReferenceError } from "./errors.js";
import { type JsonRecord, optionalRecord, parseJsonObject, sortRecord } from "./json-config.js";

export const CODEX_MCP_CONFIG_SEGMENTS = [".codex", "config.toml"] as const;
export const CLAUDE_MCP_CONFIG_SEGMENTS = [".mcp.json"] as const;
export const KIMI_MCP_CONFIG_SEGMENTS = [".kimi-code", "mcp.json"] as const;

export function codexMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CODEX_MCP_CONFIG_SEGMENTS);
}

export function claudeMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CLAUDE_MCP_CONFIG_SEGMENTS);
}

export function kimiMcpConfigPath(projectDir: string): string {
  return resolve(projectDir, ...KIMI_MCP_CONFIG_SEGMENTS);
}

/**
 * A provider MCP config as Agentyx would leave it.
 *
 * `empty` reports that nothing is left in the document once Agentyx's own
 * entries are gone — the one condition under which removing the file itself is
 * safe, and something only the code that knows the format can determine.
 */
export interface RenderedMcpConfig {
  readonly content: string;
  readonly empty: boolean;
}

/**
 * Merges resolved servers into Codex's `.codex/config.toml`.
 *
 * Unrelated keys and servers survive by value, not by byte-identical
 * formatting: `@iarna/toml` parses and re-serializes the whole document, which
 * drops comments and normalizes numeric literal style (for example `1.0`
 * becomes `1`). A surgical text-preserving TOML editor would avoid this, but
 * would trade a documented, low-risk formatting difference for a hand-rolled,
 * untested parser — not a worthwhile trade for a config file whose only
 * Agentyx-owned content is `mcp_servers`.
 */
export function renderCodexMcpConfig(
  servers: readonly McpServerDefinition[],
  existing: ExistingMcpConfig,
): RenderedMcpConfig {
  const path = CODEX_MCP_CONFIG_SEGMENTS.join("/");
  const config = parseTomlObject(existing.content, path);
  const mcpServers = mergeServers(
    optionalRecord(config.mcp_servers, path, "mcp_servers"),
    servers,
    existing.remove,
    renderCodexMcpServer,
  );

  if (Object.keys(mcpServers).length > 0) {
    config.mcp_servers = mcpServers;
  } else {
    delete config.mcp_servers;
  }

  return {
    content: stringify(sortRecord(config) as never),
    empty: Object.keys(config).length === 0,
  };
}

export function renderClaudeMcpConfig(
  servers: readonly McpServerDefinition[],
  existing: ExistingMcpConfig,
): RenderedMcpConfig {
  return renderJsonMcpConfig(
    servers,
    existing,
    CLAUDE_MCP_CONFIG_SEGMENTS.join("/"),
    renderClaudeMcpServer,
  );
}

export function renderKimiMcpConfig(
  servers: readonly McpServerDefinition[],
  existing: ExistingMcpConfig,
): RenderedMcpConfig {
  return renderJsonMcpConfig(
    servers,
    existing,
    KIMI_MCP_CONFIG_SEGMENTS.join("/"),
    renderKimiMcpServer,
  );
}

/** Claude Code and Kimi Code use the same `mcpServers` object; only the server shape differs. */
function renderJsonMcpConfig(
  servers: readonly McpServerDefinition[],
  existing: ExistingMcpConfig,
  path: string,
  renderServer: (server: McpServerDefinition) => JsonRecord,
): RenderedMcpConfig {
  const config = parseJsonObject(existing.content, path);
  const mcpServers = mergeServers(
    optionalRecord(config.mcpServers, path, "mcpServers"),
    servers,
    existing.remove,
    renderServer,
  );

  if (Object.keys(mcpServers).length > 0) {
    config.mcpServers = mcpServers;
  } else {
    delete config.mcpServers;
  }

  return {
    content: `${JSON.stringify(sortRecord(config), null, 2)}\n`,
    empty: Object.keys(config).length === 0,
  };
}

/**
 * Applies Agentyx's entries to whatever is already configured.
 *
 * Removals run first so that a server which is both resolved and listed for
 * removal ends up installed rather than dropped, and keys Agentyx never claimed
 * are carried through untouched.
 */
function mergeServers(
  configured: JsonRecord,
  servers: readonly McpServerDefinition[],
  remove: readonly string[],
  renderServer: (server: McpServerDefinition) => JsonRecord,
): JsonRecord {
  for (const name of remove) {
    delete configured[name];
  }

  for (const server of servers) {
    configured[server.name] = renderServer(server);
  }

  return sortRecord(configured);
}

/**
 * Codex's `env` table holds literal values; `env_vars` is the documented way to forward a named
 * variable from the host environment. A reference can therefore only be expressed when the server
 * expects the variable under the same name, and anything else fails instead of writing a literal
 * variable name where a secret was meant.
 */
export function renderCodexMcpServer(server: McpServerDefinition): JsonRecord {
  if (server.transport === "stdio") {
    const forwarded = Object.entries(server.env).map(([key, reference]) => {
      if (key !== reference.fromEnv) {
        throw new UnsupportedMcpEnvReferenceError(
          "codex",
          server.name,
          `Codex can only forward ${reference.fromEnv} under its own name, not as ${key}.`,
        );
      }

      return key;
    });
    const rendered: JsonRecord = {
      command: server.command,
      args: server.args,
      env: {},
      enabled: true,
    };

    if (forwarded.length > 0) {
      rendered.env_vars = forwarded.sort();
    }

    return rendered;
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

/**
 * Kimi Code documents `env` and `headers` as literal values with no reference or expansion
 * mechanism, so environment references are not rendered at all: writing the variable *name* would
 * hand the server a wrong literal. The server then depends on whatever environment Kimi Code
 * itself provides; see docs/compatibility.md.
 */
export function renderKimiMcpServer(server: McpServerDefinition): JsonRecord {
  if (server.transport === "stdio") {
    return {
      command: server.command,
      args: server.args,
      env: {},
    };
  }

  return {
    url: server.url,
  };
}

function renderExpandedEnv(env: Record<string, { fromEnv: string }>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, `\${${value.fromEnv}}`]),
  );
}

/** Codex `env_http_headers` maps header names to the *names* of environment variables. */
function renderPlainEnv(env: Record<string, { fromEnv: string }>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, value.fromEnv]),
  );
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
