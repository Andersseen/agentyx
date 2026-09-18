import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  builtInMcpServerRegistry,
  builtInPacks,
  builtInSkillRegistry,
  type SkillRegistry,
} from "@agentyx/core";

/**
 * The option lists the interactive commands offer.
 *
 * They live together so `init` and `install --select` describe the same thing
 * the same way: one hint style, one label style, one place to change it. These
 * are plain functions returning plain data — the prompting itself, and the
 * cancellation error each command raises, stay in the command.
 */
export interface PromptOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

/**
 * Every built-in pack, with its description as the hint.
 *
 * `recommended` maps a pack name to the one-line reason it was recommended. When given, those
 * packs sort first and show that reason as the hint instead of the pack's static description — the
 * concrete "why" is more useful at selection time than the generic blurb. Called with nothing, the
 * order and hints are exactly what they were before recommendations existed.
 */
export function packOptions(
  recommended: ReadonlyMap<string, string> = new Map(),
): readonly PromptOption[] {
  const ordered =
    recommended.size === 0
      ? builtInPacks
      : [
          ...builtInPacks.filter((pack) => recommended.has(pack.name)),
          ...builtInPacks.filter((pack) => !recommended.has(pack.name)),
        ];

  return ordered.map((pack) => {
    const reason = recommended.get(pack.name);
    const hint = reason ?? pack.description;

    return {
      value: pack.name,
      label: `${formatPackName(pack.name)} (${pack.category ?? "engineering"})${
        reason === undefined ? "" : " — recommended"
      }`,
      ...(hint === undefined ? {} : { hint }),
    };
  });
}

/**
 * Skills as options, with each skill's own one-line description as the hint.
 *
 * The description is what makes the list searchable by intent rather than by
 * remembering an identifier, so this is the one place that loads skill bodies
 * during a prompt. Pass a narrowed `names` list to keep that cost proportional
 * to what is actually shown.
 */
export function skillOptions(
  names: readonly string[],
  registry: SkillRegistry = builtInSkillRegistry,
): readonly PromptOption[] {
  return names.map((name) => {
    const description = describeSkill(name, registry);

    return {
      value: name,
      label: name,
      ...(description === undefined ? {} : { hint: description }),
    };
  });
}

/** Every built-in MCP server, with its transport and context cost as the hint. */
export function mcpOptions(): readonly PromptOption[] {
  return builtInMcpServerRegistry.listMetadata().map((server) => ({
    value: server.name,
    label: server.name,
    hint: `${server.transport}, ${server.contextCost ?? "unknown"} context — ${server.description}`,
  }));
}

/** Every target Agentyx can install into, marking the ones already used here. */
export function targetOptions(configured: readonly string[] = []): readonly PromptOption[] {
  const detected = new Set(configured);

  return builtInAdapterRegistry.list().map((adapter) => ({
    value: adapter.id,
    label: adapter.name,
    ...(detected.has(adapter.id) ? { hint: "detected in this project" } : {}),
  }));
}

/**
 * The skills the given packs contribute, deduplicated and in pack order.
 *
 * An empty `packs` list means "no filter" and yields every skill: narrowing is
 * a convenience for browsing, never a restriction on what can be installed.
 */
export function skillNamesForPacks(
  packs: readonly string[],
  registry: SkillRegistry = builtInSkillRegistry,
): readonly string[] {
  if (packs.length === 0) {
    return registry.names;
  }

  const selected = new Set(packs);
  const names = new Set<string>();

  for (const pack of builtInPacks) {
    if (!selected.has(pack.name)) {
      continue;
    }

    for (const skill of pack.skills ?? []) {
      if (registry.has(skill)) {
        names.add(skill);
      }
    }
  }

  return [...names];
}

/** Display name for a pack whose identifier is not its conventional spelling. */
export function formatPackName(pack: string): string {
  return pack === "typescript" ? "TypeScript" : pack === "angular" ? "Angular" : pack;
}

/**
 * A skill's description, or `undefined` when it cannot be read.
 *
 * A malformed skill must not take an interactive prompt down with it: the
 * option is still offered, just without its hint, and `install` reports the
 * real error when the skill is actually resolved.
 */
function describeSkill(name: string, registry: SkillRegistry): string | undefined {
  try {
    return registry.get(name).description;
  } catch {
    return undefined;
  }
}
