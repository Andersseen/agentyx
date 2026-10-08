import type { McpServerRegistry } from "../mcp/registry.js";
import type { CapabilityProvenance } from "./provenance.js";

export interface ContextSurfaceEntry {
  readonly name: string;
  /** `undefined` when the server declares no `contextCost`. */
  readonly contextCost: "low" | "medium" | "high" | undefined;
  readonly packs: readonly string[];
}

export interface HarnessFootprint {
  readonly packs: { readonly configured: number; readonly resolved: number };
  readonly skills: number;
  readonly mcp: { readonly active: number; readonly declared: number };
  readonly tools: { readonly active: number; readonly declared: number };
  readonly hooks: { readonly active: number; readonly declared: number };
  /**
   * Counts of active MCP servers per qualitative `contextCost`. Never summed into a token figure:
   * the classification is a rough signal, not accounting.
   */
  readonly contextSurface: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly unclassified: number;
    readonly servers: readonly ContextSurfaceEntry[];
  };
  /** Configured packs against what project detection recommends. Informational, not a verdict. */
  readonly breadth: {
    readonly configured: number;
    readonly recommended: number;
    readonly additional: readonly string[];
  };
}

export interface FootprintInput {
  readonly configuredPacks: readonly string[];
  readonly recommendedPacks: readonly string[];
  readonly resolvedPacks: readonly string[];
  readonly skills: readonly string[];
  readonly activeMcp: readonly string[];
  readonly declaredMcp: number;
  readonly activeTools: number;
  readonly declaredTools: number;
  readonly activeHooks: number;
  readonly declaredHooks: number;
  readonly provenance: readonly CapabilityProvenance[];
  readonly mcpRegistry: McpServerRegistry;
}

/** The harness footprint, derived entirely from configuration and registries. */
export function computeHarnessFootprint(input: FootprintInput): HarnessFootprint {
  const servers: ContextSurfaceEntry[] = input.activeMcp.map((name) => ({
    name,
    contextCost: input.mcpRegistry.has(name) ? input.mcpRegistry.get(name).contextCost : undefined,
    packs:
      input.provenance.find((entry) => entry.kind === "mcp" && entry.name === name)?.packs ?? [],
  }));
  const count = (cost: ContextSurfaceEntry["contextCost"]): number =>
    servers.filter((server) => server.contextCost === cost).length;
  const recommended = new Set(input.recommendedPacks);

  return {
    packs: { configured: input.configuredPacks.length, resolved: input.resolvedPacks.length },
    skills: input.skills.length,
    mcp: { active: input.activeMcp.length, declared: input.declaredMcp },
    tools: { active: input.activeTools, declared: input.declaredTools },
    hooks: { active: input.activeHooks, declared: input.declaredHooks },
    contextSurface: {
      low: count("low"),
      medium: count("medium"),
      high: count("high"),
      unclassified: count(undefined),
      servers,
    },
    breadth: {
      configured: input.configuredPacks.length,
      recommended: input.recommendedPacks.length,
      additional: input.configuredPacks.filter((name) => !recommended.has(name)),
    },
  };
}
