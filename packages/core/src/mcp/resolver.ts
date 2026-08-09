import type { AgentyxProfile } from "../config/schema.js";
import { DEFAULT_AGENTYX_PROFILE } from "../config/schema.js";
import { isMcpLevelEnabled } from "../optimization/profile.js";
import { builtInStackRegistry, type StackRegistry } from "../stack/registry.js";
import { resolveStacks } from "../stack/resolver.js";
import { builtInMcpServerRegistry } from "./built-in.js";
import { UnknownMcpServerError } from "./errors.js";
import type { McpServerRegistry } from "./registry.js";
import type { McpServerReference } from "./schema.js";

export function collectStackMcpServerReferences(
  resolvedStacks: readonly string[],
  stackRegistry: StackRegistry,
  mcpRegistry: McpServerRegistry,
): McpServerReference[] {
  const servers: McpServerReference[] = [];
  const seen = new Set<string>();

  for (const stackName of resolvedStacks) {
    for (const server of stackRegistry.get(stackName)?.mcpServers ?? []) {
      const serverName = server.name;

      if (seen.has(serverName)) {
        continue;
      }

      if (!mcpRegistry.has(serverName)) {
        throw new UnknownMcpServerError(serverName, stackName, mcpRegistry.names);
      }

      seen.add(serverName);
      servers.push(server);
    }
  }

  return servers;
}

export function filterEffectiveMcpServers(
  servers: readonly McpServerReference[],
  profile: AgentyxProfile,
): string[] {
  return servers
    .filter((server) => isMcpLevelEnabled(profile, server.level))
    .map((server) => server.name);
}

export function collectStackMcpServers(
  resolvedStacks: readonly string[],
  stackRegistry: StackRegistry,
  mcpRegistry: McpServerRegistry,
  profile: AgentyxProfile = DEFAULT_AGENTYX_PROFILE,
): string[] {
  return filterEffectiveMcpServers(
    collectStackMcpServerReferences(resolvedStacks, stackRegistry, mcpRegistry),
    profile,
  );
}

export function resolveStackMcpServerReferences(
  requestedStacks: readonly string[],
  stackRegistry: StackRegistry = builtInStackRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
): McpServerReference[] {
  return collectStackMcpServerReferences(
    resolveStacks(requestedStacks, stackRegistry),
    stackRegistry,
    mcpRegistry,
  );
}

export function resolveStackMcpServers(
  requestedStacks: readonly string[],
  stackRegistry: StackRegistry = builtInStackRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
  profile: AgentyxProfile = DEFAULT_AGENTYX_PROFILE,
): string[] {
  return collectStackMcpServers(
    resolveStacks(requestedStacks, stackRegistry),
    stackRegistry,
    mcpRegistry,
    profile,
  );
}
