import { DuplicateToolError, InvalidToolError, UnknownToolError } from "./errors.js";
import {
  type ToolDefinition,
  type ToolDefinitionInput,
  toolDefinitionSchema,
  toolNameSchema,
} from "./schema.js";

export interface ToolSource {
  readonly name: string;
  load(): ToolDefinitionInput;
}

export interface ToolMetadata {
  readonly name: string;
  readonly description: string;
  readonly kind: ToolDefinition["kind"];
  readonly command: string;
  readonly optional: boolean;
}

export interface ToolRegistry {
  readonly names: readonly string[];
  has(name: string): boolean;
  listMetadata(): readonly ToolMetadata[];
  get(name: string): ToolDefinition;
}

export function createToolRegistry(sources: Iterable<ToolSource>): ToolRegistry {
  const byName = new Map<string, ToolSource>();

  for (const source of sources) {
    const name = toolNameSchema.safeParse(source.name);

    if (!name.success) {
      throw new InvalidToolError(`tool source "${source.name}"`, name.error);
    }

    if (byName.has(name.data)) {
      throw new DuplicateToolError(name.data);
    }

    byName.set(name.data, source);
  }

  const names = [...byName.keys()];
  const loaded = new Map<string, ToolDefinition>();
  const get = (name: string): ToolDefinition => {
    const cached = loaded.get(name);

    if (cached !== undefined) {
      return cached;
    }

    const source = byName.get(name);

    if (source === undefined) {
      throw new UnknownToolError(name, undefined, names);
    }

    const origin = `tool "${name}"`;
    const tool = toolDefinitionSchema.safeParse(source.load());

    if (!tool.success) {
      throw new InvalidToolError(origin, tool.error);
    }

    if (tool.data.name !== name) {
      throw new InvalidToolError(origin, `it declares the name "${tool.data.name}"`);
    }

    loaded.set(name, tool.data);

    return tool.data;
  };

  return {
    names,
    has: (name) => byName.has(name),
    listMetadata: () =>
      names.map((name) => {
        const tool = get(name);

        return {
          name: tool.name,
          description: tool.description,
          kind: tool.kind,
          command: tool.command,
          optional: tool.optional,
        };
      }),
    get,
  };
}
