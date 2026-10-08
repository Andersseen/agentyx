import type { PackRegistry } from "../pack/registry.js";

export type CapabilityKind = "skill" | "mcp" | "tool" | "hook";

export interface CapabilityProvenance {
  readonly kind: CapabilityKind;
  readonly name: string;
  /** Resolved packs that contribute this capability, in resolution order. One capability, many packs. */
  readonly packs: readonly string[];
  /** `optional` only when every contributing pack declares it optional. */
  readonly activation: "default" | "optional";
}

/**
 * Derives capability → contributing packs from the pack registry, so there is no second map to keep
 * in sync. A capability two packs both contribute appears once, with both packs listed: it is one
 * runtime capability, not two.
 */
export function deriveCapabilityProvenance(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
): CapabilityProvenance[] {
  const byKey = new Map<
    string,
    { kind: CapabilityKind; name: string; packs: string[]; activation: "default" | "optional" }
  >();

  const add = (
    kind: CapabilityKind,
    name: string,
    pack: string,
    activation: "default" | "optional",
  ): void => {
    const key = `${kind}:${name}`;
    const existing = byKey.get(key);

    if (existing === undefined) {
      byKey.set(key, { kind, name, packs: [pack], activation });
      return;
    }

    existing.packs.push(pack);

    if (activation === "default") {
      existing.activation = "default";
    }
  };

  for (const packName of resolvedPacks) {
    const pack = packRegistry.get(packName);

    if (pack === undefined) {
      continue;
    }

    for (const skill of pack.skills) {
      add("skill", skill, packName, "default");
    }

    for (const server of pack.mcpServers) {
      add("mcp", server.name, packName, server.activation);
    }

    for (const tool of pack.tools) {
      add("tool", tool.name, packName, tool.activation);
    }

    for (const hook of pack.hooks) {
      add("hook", hook.name, packName, hook.activation);
    }
  }

  return [...byKey.values()];
}
