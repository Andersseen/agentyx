import type { AgentAdapter } from "./adapter.js";
import { DuplicateAdapterError, UnknownAdapterError } from "./errors.js";

/**
 * A lookup of adapters by target id.
 *
 * Adapters are supplied as plain values, so a third-party adapter is an object
 * that satisfies `AgentAdapter` handed to `createAdapterRegistry` — no dynamic
 * imports, no discovery protocol, nothing to publish anywhere.
 */
export interface AdapterRegistry {
  /** Registered ids, in registration order. */
  readonly ids: readonly string[];
  has(id: string): boolean;
  /** @throws {UnknownAdapterError} when the id is not registered. */
  get(id: string): AgentAdapter;
  list(): readonly AgentAdapter[];
}

/**
 * Indexes adapters by id.
 *
 * @throws {DuplicateAdapterError} when two adapters share an id.
 */
export function createAdapterRegistry(adapters: Iterable<AgentAdapter>): AdapterRegistry {
  const byId = new Map<string, AgentAdapter>();

  for (const adapter of adapters) {
    if (byId.has(adapter.id)) {
      throw new DuplicateAdapterError(adapter.id);
    }

    byId.set(adapter.id, adapter);
  }

  const ids = [...byId.keys()];

  return {
    ids,
    has: (id) => byId.has(id),
    get: (id) => {
      const adapter = byId.get(id);

      if (adapter === undefined) {
        throw new UnknownAdapterError(id, ids);
      }

      return adapter;
    },
    list: () => [...byId.values()],
  };
}
