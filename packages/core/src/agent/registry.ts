import { DuplicateAgentError, InvalidAgentError, UnknownAgentError } from "./errors.js";
import {
  type AgentDefinition,
  type AgentDefinitionInput,
  agentDefinitionSchema,
  agentNameSchema,
} from "./schema.js";

export interface AgentSource {
  readonly name: string;
  load(): AgentDefinitionInput;
}
export interface AgentRegistry {
  readonly names: readonly string[];
  has(name: string): boolean;
  get(name: string): AgentDefinition;
}

export function createAgentRegistry(sources: Iterable<AgentSource>): AgentRegistry {
  const byName = new Map<string, AgentSource>();
  for (const source of sources) {
    const parsed = agentNameSchema.safeParse(source.name);
    if (!parsed.success) throw new InvalidAgentError(source.name, parsed.error.message);
    if (byName.has(parsed.data)) throw new DuplicateAgentError(parsed.data);
    byName.set(parsed.data, source);
  }
  const names = [...byName.keys()];
  const cache = new Map<string, AgentDefinition>();
  return {
    names,
    has: (name) => byName.has(name),
    get(name) {
      const cached = cache.get(name);
      if (cached) return cached;
      const source = byName.get(name);
      if (!source) throw new UnknownAgentError(name);
      const parsed = agentDefinitionSchema.safeParse(source.load());
      if (!parsed.success || parsed.data.name !== name)
        throw new InvalidAgentError(
          name,
          parsed.success ? `declares ${parsed.data.name}` : parsed.error.message,
        );
      cache.set(name, parsed.data);
      return parsed.data;
    },
  };
}
