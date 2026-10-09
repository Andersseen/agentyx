import { AgentyxError } from "../errors.js";
import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import type { SkillRegistry } from "../skill/registry.js";
import { resolveAgentyxConfig } from "./resolver.js";
import { type AgentyxConfig, agentyxConfigSchema } from "./schema.js";

export interface AgentyxConfigMutations {
  readonly addPacks?: readonly string[];
  readonly removePacks?: readonly string[];
  readonly enable?: readonly string[];
  readonly disable?: readonly string[];
  readonly addTargets?: readonly string[];
  readonly removeTargets?: readonly string[];
}

export interface AgentyxConfigMutationChanges {
  readonly packs: { readonly added: readonly string[]; readonly removed: readonly string[] };
  readonly capabilities: {
    readonly enabled: readonly string[];
    readonly disabled: readonly string[];
    readonly orphaned: readonly string[];
  };
  readonly targets: { readonly added: readonly string[]; readonly removed: readonly string[] };
}

export interface AgentyxConfigMutationResult {
  readonly config: AgentyxConfig;
  readonly changes: AgentyxConfigMutationChanges;
}

export class AgentyxConfigMutationError extends AgentyxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AgentyxConfigMutationError";
  }
}

/** Mutate a validated config while preserving all unrelated project-owned fields. */
export function mutateAgentyxConfig(
  config: AgentyxConfig,
  mutations: AgentyxConfigMutations,
  registry: PackRegistry = builtInPackRegistry,
  skillRegistry: SkillRegistry = builtInSkillRegistry,
): AgentyxConfigMutationResult {
  assertNoContradictions(mutations);
  resolveAgentyxConfig(config, registry, skillRegistry);
  const addPacks = unique(mutations.addPacks ?? []);
  const removePacks = unique(mutations.removePacks ?? []);
  for (const name of [...addPacks, ...removePacks]) {
    registry.get(name);
  }

  const beforePacks = unique(config.packs);
  const packs = [...beforePacks.filter((name) => !removePacks.includes(name))];
  const addedPacks = addPacks.filter((name) => !packs.includes(name));
  packs.push(...addedPacks);
  const removedPacks = beforePacks.filter((name) => removePacks.includes(name));

  const base = { ...config, packs };
  const declared = resolveAgentyxConfig({ ...base, enable: [] }, registry, skillRegistry);
  const available = new Set([
    ...declared.declaredMcpServers
      .filter((item) => item.activation === "optional")
      .map((item) => item.name),
    ...declared.declaredTools
      .filter((item) => item.activation === "optional")
      .map((item) => item.name),
    ...declared.declaredHooks
      .filter((item) => item.activation === "optional")
      .map((item) => item.name),
    ...declared.declaredAgents
      .filter((item) => item.activation === "optional")
      .map((item) => item.name),
  ]);
  const enable = unique(mutations.enable ?? []);
  const disable = unique(mutations.disable ?? []);
  for (const capability of enable) {
    if (!available.has(capability)) {
      throw new AgentyxConfigMutationError(
        "config_mutation_capability_unavailable",
        `Optional capability "${capability}" is not declared by the resulting selected packs.`,
      );
    }
  }

  const orphaned = unique(config.enable).filter((capability) => !available.has(capability));
  const explicitlyDisabled = unique(config.enable).filter(
    (capability) => disable.includes(capability) && available.has(capability),
  );
  const nextEnable = unique(config.enable).filter(
    (capability) => !disable.includes(capability) && available.has(capability),
  );
  const addedCapabilities = enable.filter((name) => !nextEnable.includes(name));
  nextEnable.push(...addedCapabilities);

  const beforeTargets = unique(config.targets);
  const targets = beforeTargets.filter(
    (target) => !(mutations.removeTargets ?? []).includes(target),
  );
  const addedTargets = unique(mutations.addTargets ?? []).filter(
    (target) => !targets.includes(target),
  );
  targets.push(...addedTargets);
  const removedTargets = beforeTargets.filter((target) =>
    (mutations.removeTargets ?? []).includes(target),
  );

  const nextConfig = agentyxConfigSchema.parse({ ...config, packs, enable: nextEnable, targets });
  resolveAgentyxConfig(nextConfig, registry, skillRegistry);

  return {
    config: nextConfig,
    changes: {
      packs: { added: addedPacks, removed: removedPacks },
      capabilities: {
        enabled: addedCapabilities,
        disabled: explicitlyDisabled,
        orphaned,
      },
      targets: { added: addedTargets, removed: removedTargets },
    },
  };
}

function assertNoContradictions(mutations: AgentyxConfigMutations): void {
  const pairs = [
    [mutations.addPacks, mutations.removePacks, "pack"],
    [mutations.enable, mutations.disable, "capability"],
    [mutations.addTargets, mutations.removeTargets, "target"],
  ] as const;
  for (const [adding, removing, kind] of pairs) {
    const conflicts = unique(adding ?? []).filter((name) => (removing ?? []).includes(name));
    if (conflicts.length > 0) {
      throw new AgentyxConfigMutationError(
        `config_mutation_contradictory_${kind}`,
        `Cannot both add and remove the same ${kind}: ${conflicts.join(", ")}.`,
      );
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
