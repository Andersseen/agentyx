import { DuplicateStackError } from "./errors.js";
import {
  type StackDefinition,
  type StackDefinitionInput,
  stackDefinitionSchema,
} from "./schema.js";

/**
 * A registry is a name lookup over stack definitions. Keeping it a plain map
 * means the resolver stays independent of where definitions come from, so
 * external registries can be added later without touching resolution.
 */
export type StackRegistry = ReadonlyMap<string, StackDefinition>;

/** Validates definitions and indexes them by name. */
export function createStackRegistry(definitions: Iterable<StackDefinitionInput>): StackRegistry {
  const registry = new Map<string, StackDefinition>();

  for (const definition of definitions) {
    const stack = stackDefinitionSchema.parse(definition);

    if (registry.has(stack.name)) {
      throw new DuplicateStackError(stack.name);
    }

    registry.set(stack.name, stack);
  }

  return registry;
}

/**
 * The stacks Agnox ships with, expressed as data. Relationships live here, not
 * in the resolver.
 */
export const builtInStacks: readonly StackDefinitionInput[] = [
  {
    name: "core",
    description: "Baseline development environment shared by every Agnox stack.",
    skills: ["planning", "systematic-debugging", "verification"],
  },
  {
    name: "typescript",
    description: "TypeScript development environment.",
    extends: ["core"],
    skills: ["typescript-modern"],
  },
  {
    name: "angular",
    description: "Modern Angular development environment.",
    extends: ["typescript"],
    skills: ["angular-modern"],
    mcpServers: [{ name: "context7", level: "recommended" }],
  },
];

/** The registry used by default when no explicit registry is supplied. */
export const builtInStackRegistry: StackRegistry = createStackRegistry(builtInStacks);
