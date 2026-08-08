import { DuplicateMcpServerError, InvalidMcpServerError, UnknownMcpServerError } from "./errors.js";
import {
  type McpServerDefinition,
  type McpServerDefinitionInput,
  mcpServerDefinitionSchema,
  mcpServerNameSchema,
} from "./schema.js";

export interface McpServerSource {
  readonly name: string;
  load(): McpServerDefinitionInput;
}

export interface McpServerMetadata {
  readonly name: string;
  readonly description: string;
  readonly transport: McpServerDefinition["transport"];
}

export interface McpServerRegistry {
  readonly names: readonly string[];
  has(name: string): boolean;
  listMetadata(): readonly McpServerMetadata[];
  get(name: string): McpServerDefinition;
}

export function createMcpServerRegistry(sources: Iterable<McpServerSource>): McpServerRegistry {
  const byName = new Map<string, McpServerSource>();

  for (const source of sources) {
    const name = mcpServerNameSchema.safeParse(source.name);

    if (!name.success) {
      throw new InvalidMcpServerError(`MCP server source "${source.name}"`, name.error);
    }

    if (byName.has(name.data)) {
      throw new DuplicateMcpServerError(name.data);
    }

    byName.set(name.data, source);
  }

  const names = [...byName.keys()];
  const loaded = new Map<string, McpServerDefinition>();
  const get = (name: string): McpServerDefinition => {
    const cached = loaded.get(name);

    if (cached !== undefined) {
      return cached;
    }

    const source = byName.get(name);

    if (source === undefined) {
      throw new UnknownMcpServerError(name, undefined, names);
    }

    const origin = `MCP server "${name}"`;
    const server = mcpServerDefinitionSchema.safeParse(source.load());

    if (!server.success) {
      throw new InvalidMcpServerError(origin, server.error);
    }

    if (server.data.name !== name) {
      throw new InvalidMcpServerError(origin, `it declares the name "${server.data.name}"`);
    }

    loaded.set(name, server.data);

    return server.data;
  };

  return {
    names,
    has: (name) => byName.has(name),
    listMetadata: () =>
      names.map((name) => {
        const server = get(name);

        return {
          name: server.name,
          description: server.description,
          transport: server.transport,
        };
      }),
    get,
  };
}
