import { builtInStackRegistry, type StackRegistry } from "../stack/registry.js";
import { resolveStacks } from "../stack/resolver.js";
import { builtInMcpServerRegistry } from "./built-in.js";
import { UnknownMcpServerError } from "./errors.js";
import type { McpServerRegistry } from "./registry.js";

export function collectStackMcpServers(
  resolvedStacks: readonly string[],
  stackRegistry: StackRegistry,
  mcpRegistry: McpServerRegistry,
): string[] {
  const servers: string[] = [];
  const seen = new Set<string>();

  for (const stackName of resolvedStacks) {
    for (const serverName of stackRegistry.get(stackName)?.mcpServers ?? []) {
      if (seen.has(serverName)) {
        continue;
      }

      if (!mcpRegistry.has(serverName)) {
        throw new UnknownMcpServerError(serverName, stackName, mcpRegistry.names);
      }

      seen.add(serverName);
      servers.push(serverName);
    }
  }

  return servers;
}

export function resolveStackMcpServers(
  requestedStacks: readonly string[],
  stackRegistry: StackRegistry = builtInStackRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
): string[] {
  return collectStackMcpServers(
    resolveStacks(requestedStacks, stackRegistry),
    stackRegistry,
    mcpRegistry,
  );
}
