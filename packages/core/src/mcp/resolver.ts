import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInMcpServerRegistry } from "./built-in.js";
import { UnknownMcpServerError } from "./errors.js";
import type { McpServerRegistry } from "./registry.js";
import type { McpServerReference } from "./schema.js";

export function collectPackMcpServerReferences(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  mcpRegistry: McpServerRegistry,
): McpServerReference[] {
  const servers: McpServerReference[] = [];
  const seen = new Map<string, number>();

  for (const packName of resolvedPacks) {
    for (const server of packRegistry.get(packName)?.mcpServers ?? []) {
      const serverName = server.name;

      const existing = seen.get(serverName);

      if (existing !== undefined) {
        // One capability, many packs: a default contribution wins over an optional one.
        if (server.activation === "default" && servers[existing]?.activation === "optional") {
          servers[existing] = server;
        }

        continue;
      }

      if (!mcpRegistry.has(serverName)) {
        throw new UnknownMcpServerError(serverName, packName, mcpRegistry.names);
      }

      seen.set(serverName, servers.length);
      servers.push(server);
    }
  }

  return servers;
}

export function filterEffectiveMcpServers(
  servers: readonly McpServerReference[],
  enabledCapabilities: readonly string[],
  excludedCapabilities: readonly string[] = [],
): string[] {
  const enabled = new Set(enabledCapabilities);
  const excluded = new Set(excludedCapabilities);

  return servers
    .filter((server) => !excluded.has(server.name))
    .filter((server) => server.activation === "default" || enabled.has(server.name))
    .map((server) => server.name);
}

export function collectPackMcpServers(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  mcpRegistry: McpServerRegistry,
  enabledCapabilities: readonly string[] = [],
): string[] {
  return filterEffectiveMcpServers(
    collectPackMcpServerReferences(resolvedPacks, packRegistry, mcpRegistry),
    enabledCapabilities,
  );
}

export function resolvePackMcpServerReferences(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
): McpServerReference[] {
  return collectPackMcpServerReferences(
    resolvePacks(requestedPacks, packRegistry),
    packRegistry,
    mcpRegistry,
  );
}

export function resolvePackMcpServers(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
  enabledCapabilities: readonly string[] = [],
): string[] {
  return collectPackMcpServers(
    resolvePacks(requestedPacks, packRegistry),
    packRegistry,
    mcpRegistry,
    enabledCapabilities,
  );
}
