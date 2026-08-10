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
  const seen = new Set<string>();

  for (const packName of resolvedPacks) {
    for (const server of packRegistry.get(packName)?.mcpServers ?? []) {
      const serverName = server.name;

      if (seen.has(serverName)) {
        continue;
      }

      if (!mcpRegistry.has(serverName)) {
        throw new UnknownMcpServerError(serverName, packName, mcpRegistry.names);
      }

      seen.add(serverName);
      servers.push(server);
    }
  }

  return servers;
}

export function filterEffectiveMcpServers(
  servers: readonly McpServerReference[],
  enabledCapabilities: readonly string[],
): string[] {
  const enabled = new Set(enabledCapabilities);

  return servers
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
