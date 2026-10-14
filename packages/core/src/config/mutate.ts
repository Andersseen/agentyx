import { AgentyxError } from "../errors.js";
import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import type { SkillRegistry } from "../skill/registry.js";
import { resolveAgentyxConfig } from "./resolver.js";
import { type AgentyxConfig, agentyxConfigSchema, type CapabilityExclusions } from "./schema.js";

export type CapabilitySelectionKind = "skill" | "mcp" | "tool" | "hook" | "agent";
export interface CapabilitySelection {
  readonly kind: CapabilitySelectionKind;
  readonly name: string;
}

export interface AgentyxConfigMutations {
  readonly addPacks?: readonly string[];
  readonly removePacks?: readonly string[];
  readonly enable?: readonly string[];
  readonly disable?: readonly string[];
  readonly addTargets?: readonly string[];
  readonly removeTargets?: readonly string[];
  readonly addExclusions?: readonly CapabilitySelection[];
  readonly removeExclusions?: readonly CapabilitySelection[];
}

export interface AgentyxConfigMutationChanges {
  readonly packs: { readonly added: readonly string[]; readonly removed: readonly string[] };
  readonly capabilities: {
    readonly enabled: readonly string[];
    readonly disabled: readonly string[];
    readonly orphaned: readonly string[];
  };
  readonly exclusions: {
    readonly added: readonly CapabilitySelection[];
    readonly removed: readonly CapabilitySelection[];
    readonly orphaned: readonly CapabilitySelection[];
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
  const declared = resolveAgentyxConfig(
    { ...base, enable: [], exclude: undefined },
    registry,
    skillRegistry,
  );
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

  const beforeExclusions = selectionsFromConfig(config.exclude);
  const requestedAdds = uniqueSelections(mutations.addExclusions ?? []);
  const requestedRemoves = uniqueSelections(mutations.removeExclusions ?? []);
  const currentKeys = new Set(requestedRemoves.map(selectionKey));
  const nextExclusions = beforeExclusions.filter(
    (selection) => !currentKeys.has(selectionKey(selection)),
  );
  const addedExclusions = requestedAdds.filter(
    (selection) =>
      !nextExclusions.some((current) => selectionKey(current) === selectionKey(selection)),
  );
  nextExclusions.push(...addedExclusions);
  const availableByKind = new Set(declared.declaredMcpServers.map((item) => `mcp:${item.name}`));
  for (const item of declared.declaredTools) availableByKind.add(`tool:${item.name}`);
  for (const item of declared.declaredHooks) availableByKind.add(`hook:${item.name}`);
  for (const item of declared.declaredAgents) availableByKind.add(`agent:${item.name}`);
  for (const name of declared.skills) availableByKind.add(`skill:${name}`);
  const orphanedExclusions = nextExclusions.filter(
    (selection) =>
      beforeExclusions.some((item) => selectionKey(item) === selectionKey(selection)) &&
      !availableByKind.has(selectionKey(selection)),
  );
  const orphanedKeys = new Set(orphanedExclusions.map(selectionKey));
  const finalExclusions = nextExclusions.filter(
    (selection) => !orphanedKeys.has(selectionKey(selection)),
  );

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

  const exclude = exclusionsToConfig(finalExclusions);
  const nextConfig = agentyxConfigSchema.parse({
    ...config,
    packs,
    enable: nextEnable,
    targets,
    ...(exclude === undefined ? { exclude: undefined } : { exclude }),
  });
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
      exclusions: {
        added: addedExclusions.filter(
          (selection) =>
            !orphanedExclusions.some((item) => selectionKey(item) === selectionKey(selection)),
        ),
        removed: requestedRemoves.filter((selection) =>
          beforeExclusions.some((item) => selectionKey(item) === selectionKey(selection)),
        ),
        orphaned: orphanedExclusions,
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
  const added = uniqueSelections(mutations.addExclusions ?? []);
  const removed = new Set((mutations.removeExclusions ?? []).map(selectionKey));
  const conflicts = added.filter((selection) => removed.has(selectionKey(selection)));
  if (conflicts.length > 0) {
    throw new AgentyxConfigMutationError(
      "config_mutation_contradictory_exclusion",
      `Cannot both add and remove the same exclusion: ${conflicts.map(selectionKey).join(", ")}.`,
    );
  }
}

function selectionsFromConfig(exclude: AgentyxConfig["exclude"]): CapabilitySelection[] {
  return [
    ...(exclude?.skills ?? []).map((name) => ({ kind: "skill" as const, name })),
    ...(exclude?.mcpServers ?? []).map((name) => ({ kind: "mcp" as const, name })),
    ...(exclude?.tools ?? []).map((name) => ({ kind: "tool" as const, name })),
    ...(exclude?.hooks ?? []).map((name) => ({ kind: "hook" as const, name })),
    ...(exclude?.agents ?? []).map((name) => ({ kind: "agent" as const, name })),
  ];
}

function exclusionsToConfig(
  selections: readonly CapabilitySelection[],
): CapabilityExclusions | undefined {
  if (selections.length === 0) return undefined;
  return {
    skills: selections.filter((item) => item.kind === "skill").map((item) => item.name),
    mcpServers: selections.filter((item) => item.kind === "mcp").map((item) => item.name),
    tools: selections.filter((item) => item.kind === "tool").map((item) => item.name),
    hooks: selections.filter((item) => item.kind === "hook").map((item) => item.name),
    agents: selections.filter((item) => item.kind === "agent").map((item) => item.name),
  };
}

function selectionKey(selection: CapabilitySelection): string {
  return `${selection.kind}:${selection.name}`;
}

function uniqueSelections(selections: readonly CapabilitySelection[]): CapabilitySelection[] {
  const seen = new Set<string>();
  return selections.filter((selection) => {
    const key = selectionKey(selection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
