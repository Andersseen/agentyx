import { DuplicateTrustedSourceError, UnknownTrustedSourceError } from "./errors.js";
import {
  type TrustedSourceDefinition,
  type TrustedSourceReference,
  trustedSourceDefinitionSchema,
} from "./schema.js";

export type TrustedSourceRegistry = ReadonlyMap<string, TrustedSourceDefinition>;

export const knownTrustedSources: readonly TrustedSourceDefinition[] = [
  trustedSourceDefinitionSchema.parse({
    name: "superpowers",
    displayName: "Superpowers",
    repository: "https://github.com/obra/superpowers",
    type: "codex-plugin",
    manifestPath: ".codex-plugin/plugin.json",
    recommendedPath: ".agentyx/sources/superpowers",
    description:
      "Agentic planning, TDD, debugging, code review and delivery workflows packaged as a Codex plugin.",
    installStatus: "metadata-only",
    installNote:
      "Agentyx can inspect and verify the local plugin checkout, but does not install its resource-bearing skills yet.",
  }),
];

export const knownTrustedSourceRegistry: TrustedSourceRegistry =
  createTrustedSourceRegistry(knownTrustedSources);

export function createTrustedSourceRegistry(
  definitions: Iterable<TrustedSourceDefinition>,
): TrustedSourceRegistry {
  const registry = new Map<string, TrustedSourceDefinition>();

  for (const definition of definitions) {
    const parsed = trustedSourceDefinitionSchema.parse(definition);

    if (registry.has(parsed.name)) {
      throw new DuplicateTrustedSourceError(parsed.name);
    }

    registry.set(parsed.name, parsed);
  }

  return registry;
}

export function getTrustedSourceDefinition(
  source: string | TrustedSourceReference,
  registry: TrustedSourceRegistry = knownTrustedSourceRegistry,
): TrustedSourceDefinition {
  const name = typeof source === "string" ? source : source.name;
  const definition = registry.get(name);

  if (definition === undefined) {
    throw new UnknownTrustedSourceError(name, [...registry.keys()]);
  }

  return definition;
}
