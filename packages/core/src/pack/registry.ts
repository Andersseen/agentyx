import { DuplicatePackError } from "./errors.js";
import { type PackDefinition, type PackDefinitionInput, packDefinitionSchema } from "./schema.js";

/**
 * A registry is a name lookup over pack definitions. Keeping it a plain map
 * means the resolver stays independent of where definitions come from, so
 * external registries can be added later without touching resolution.
 */
export type PackRegistry = ReadonlyMap<string, PackDefinition>;

/** Validates definitions and indexes them by name. */
export function createPackRegistry(definitions: Iterable<PackDefinitionInput>): PackRegistry {
  const registry = new Map<string, PackDefinition>();

  for (const definition of definitions) {
    const pack = packDefinitionSchema.parse(definition);

    if (registry.has(pack.name)) {
      throw new DuplicatePackError(pack.name);
    }

    registry.set(pack.name, pack);
  }

  return registry;
}

/**
 * The packs Agentyx ships with, expressed as data. Relationships live here, not
 * in the resolver.
 */
export const builtInPacks: readonly PackDefinitionInput[] = [
  {
    name: "technical",
    category: "engineering",
    description: "General software-engineering quality independent of language or framework.",
    skills: ["engineering-principles", "code-quality", "api-design", "code-review"],
  },
  {
    name: "typescript",
    category: "language",
    description: "TypeScript language conventions for strict, modern code.",
    skills: ["typescript-strict", "typescript-modeling", "typescript-modern"],
  },
  {
    name: "angular",
    category: "framework",
    description: "Modern Angular development environment.",
    skills: ["angular-modern", "angular-signals", "angular-architecture", "angular-testing"],
    mcpServers: ["context7"],
  },
  {
    name: "efficiency",
    category: "efficiency",
    description: "Reduce context and tool overhead without weakening verification.",
    skills: [
      "context-efficient-development",
      "concise-output",
      "targeted-exploration",
      "focused-verification",
    ],
    mcpServers: [{ name: "codebase-memory", activation: "optional" }],
    tools: [{ name: "rtk", activation: "optional" }],
  },
  {
    name: "agentic",
    category: "workflow",
    description: "Provider-neutral development workflows for substantial coding-agent work.",
    skills: [
      "brainstorming",
      "planning",
      "systematic-debugging",
      "verification",
      "parallel-work",
      "worktree-workflow",
      "subagent-driven-development",
      "requesting-code-review",
    ],
  },
];

/** The registry used by default when no explicit registry is supplied. */
export const builtInPackRegistry: PackRegistry = createPackRegistry(builtInPacks);
