import { z } from "zod";
import { deriveCapabilityProvenance } from "../harness/provenance.js";
import type { PackRegistry } from "../pack/registry.js";
import type { ResolvedAgentyxConfig } from "./resolver.js";

const CAPABILITY_ORDER = ["skill", "mcp", "tool", "hook", "agent"] as const;

/** Where a capability comes from: a pack, or the project's own context configuration. */
export const resolutionOriginSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("pack"), name: z.string().min(1) }),
  z.strictObject({ kind: z.literal("project-context") }),
]);

export const resolutionExplanationEntrySchema = z.strictObject({
  kind: z.enum(CAPABILITY_ORDER),
  name: z.string().min(1),
  /** Contributing origins, in resolution order, each once. */
  origins: z.array(resolutionOriginSchema),
  activation: z.enum(["default", "optional"]),
  active: z.boolean(),
  reason: z.enum([
    "default",
    "explicitly-enabled",
    "optional-disabled",
    "excluded",
    "project-context",
  ]),
});

export type ResolutionOrigin = z.infer<typeof resolutionOriginSchema>;
export type ResolutionExplanationEntry = z.infer<typeof resolutionExplanationEntrySchema>;

/**
 * Explains a resolution: why each declared capability is, or is not, part of the effective harness.
 *
 * Derived from the resolved configuration and the same pack provenance Doctor uses — it never
 * resolves again, reads files or includes instructions, environment values or arguments.
 */
export function explainAgentyxResolution(
  resolved: ResolvedAgentyxConfig,
  packRegistry: PackRegistry,
): ResolutionExplanationEntry[] {
  const provenance = deriveCapabilityProvenance(resolved.resolvedPacks, packRegistry);
  const effective = {
    skill: new Set(resolved.skills),
    mcp: new Set(resolved.mcpServers),
    tool: new Set(resolved.tools),
    hook: new Set(resolved.hooks),
    agent: new Set(resolved.agents),
  };
  const enabled = new Set(resolved.enabled);
  const entries: ResolutionExplanationEntry[] = [];

  for (const kind of CAPABILITY_ORDER) {
    for (const capability of provenance.filter((entry) => entry.kind === kind)) {
      const active = effective[kind].has(capability.name);

      entries.push({
        kind,
        name: capability.name,
        origins: capability.packs.map((name) => ({ kind: "pack", name })),
        activation: capability.activation,
        active,
        reason: isExcluded(resolved, kind, capability.name)
          ? "excluded"
          : capability.activation === "default"
            ? "default"
            : enabled.has(capability.name)
              ? "explicitly-enabled"
              : "optional-disabled",
      });
    }

    if (kind === "skill") {
      // A skill no pack contributes can only be the one synthesized from project context.
      const fromPacks = new Set(
        provenance.filter((entry) => entry.kind === "skill").map((entry) => entry.name),
      );

      for (const name of resolved.skills.filter((skill) => !fromPacks.has(skill))) {
        entries.push({
          kind: "skill",
          name,
          origins: [{ kind: "project-context" }],
          activation: "default",
          active: true,
          reason: "project-context",
        });
      }
    }
  }

  return entries;
}

function isExcluded(
  resolved: ResolvedAgentyxConfig,
  kind: (typeof CAPABILITY_ORDER)[number],
  name: string,
): boolean {
  const key: keyof ResolvedAgentyxConfig["excluded"] =
    kind === "skill"
      ? "skills"
      : kind === "mcp"
        ? "mcpServers"
        : kind === "tool"
          ? "tools"
          : kind === "hook"
            ? "hooks"
            : "agents";
  return resolved.excluded[key].includes(name);
}
