import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInToolRegistry } from "./built-in.js";
import { UnknownToolError } from "./errors.js";
import type { ToolRegistry } from "./registry.js";
import type { ToolReference } from "./schema.js";

export function collectPackToolReferences(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  toolRegistry: ToolRegistry,
): ToolReference[] {
  const tools: ToolReference[] = [];
  const seen = new Map<string, number>();

  for (const packName of resolvedPacks) {
    for (const tool of packRegistry.get(packName)?.tools ?? []) {
      const existing = seen.get(tool.name);

      if (existing !== undefined) {
        // One capability, many packs: a default contribution wins over an optional one.
        if (tool.activation === "default" && tools[existing]?.activation === "optional") {
          tools[existing] = tool;
        }

        continue;
      }

      if (!toolRegistry.has(tool.name)) {
        throw new UnknownToolError(tool.name, packName, toolRegistry.names);
      }

      seen.set(tool.name, tools.length);
      tools.push(tool);
    }
  }

  return tools;
}

export function filterEffectiveTools(
  tools: readonly ToolReference[],
  enabledCapabilities: readonly string[],
): string[] {
  const enabled = new Set(enabledCapabilities);

  return tools
    .filter((tool) => tool.activation === "default" || enabled.has(tool.name))
    .map((tool) => tool.name);
}

export function resolvePackToolReferences(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  toolRegistry: ToolRegistry = builtInToolRegistry,
): ToolReference[] {
  return collectPackToolReferences(
    resolvePacks(requestedPacks, packRegistry),
    packRegistry,
    toolRegistry,
  );
}

export function resolvePackTools(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  toolRegistry: ToolRegistry = builtInToolRegistry,
  enabledCapabilities: readonly string[] = [],
): string[] {
  return filterEffectiveTools(
    resolvePackToolReferences(requestedPacks, packRegistry, toolRegistry),
    enabledCapabilities,
  );
}
