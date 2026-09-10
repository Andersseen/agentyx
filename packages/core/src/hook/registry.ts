import { DuplicateHookError, InvalidHookError, UnknownHookError } from "./errors.js";
import {
  type HookDefinition,
  type HookDefinitionInput,
  hookDefinitionSchema,
  hookNameSchema,
} from "./schema.js";

export interface HookSource {
  readonly name: string;
  load(): HookDefinitionInput;
}

export interface HookMetadata {
  readonly name: string;
  readonly description: string;
  readonly event: HookDefinition["event"];
}

export interface HookRegistry {
  readonly names: readonly string[];
  has(name: string): boolean;
  listMetadata(): readonly HookMetadata[];
  get(name: string): HookDefinition;
}

export function createHookRegistry(sources: Iterable<HookSource>): HookRegistry {
  const byName = new Map<string, HookSource>();

  for (const source of sources) {
    const name = hookNameSchema.safeParse(source.name);

    if (!name.success) {
      throw new InvalidHookError(`Hook source "${source.name}"`, name.error);
    }

    if (byName.has(name.data)) {
      throw new DuplicateHookError(name.data);
    }

    byName.set(name.data, source);
  }

  const names = [...byName.keys()];
  const loaded = new Map<string, HookDefinition>();
  const get = (name: string): HookDefinition => {
    const cached = loaded.get(name);

    if (cached !== undefined) {
      return cached;
    }

    const source = byName.get(name);

    if (source === undefined) {
      throw new UnknownHookError(name, undefined, names);
    }

    const origin = `Hook "${name}"`;
    const hook = hookDefinitionSchema.safeParse(source.load());

    if (!hook.success) {
      throw new InvalidHookError(origin, hook.error);
    }

    if (hook.data.name !== name) {
      throw new InvalidHookError(origin, `it declares the name "${hook.data.name}"`);
    }

    loaded.set(name, hook.data);

    return hook.data;
  };

  return {
    names,
    has: (name) => byName.has(name),
    listMetadata: () =>
      names.map((name) => {
        const hook = get(name);

        return {
          name: hook.name,
          description: hook.description,
          event: hook.event,
        };
      }),
    get,
  };
}
