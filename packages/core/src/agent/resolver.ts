import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInAgentRegistry } from "./built-in.js";
import { UnknownAgentError } from "./errors.js";
import type { AgentRegistry } from "./registry.js";
import type { AgentReference } from "./schema.js";

export function collectPackAgentReferences(
  packs: readonly string[],
  packRegistry: PackRegistry,
  agentRegistry: AgentRegistry,
): AgentReference[] {
  const result: AgentReference[] = [];
  const seen = new Map<string, number>();
  for (const pack of packs)
    for (const reference of packRegistry.get(pack)?.agents ?? []) {
      if (!agentRegistry.has(reference.name)) throw new UnknownAgentError(reference.name, pack);
      const existing = seen.get(reference.name);
      if (existing === undefined) {
        seen.set(reference.name, result.length);
        result.push(reference);
      } else if (
        reference.activation === "default" &&
        result[existing]?.activation === "optional"
      ) {
        // One capability, many packs: a default contribution wins over an optional one.
        result[existing] = reference;
      }
    }
  return result;
}

export function filterEffectiveAgents(
  agents: readonly AgentReference[],
  enabled: readonly string[],
  excluded: readonly string[] = [],
): string[] {
  const active = new Set(enabled);
  const excludedNames = new Set(excluded);
  return agents
    .filter((agent) => !excludedNames.has(agent.name))
    .filter((agent) => agent.activation === "default" || active.has(agent.name))
    .map(({ name }) => name);
}

export function resolvePackAgents(
  packs: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  agentRegistry: AgentRegistry = builtInAgentRegistry,
): AgentReference[] {
  return collectPackAgentReferences(resolvePacks(packs, packRegistry), packRegistry, agentRegistry);
}
