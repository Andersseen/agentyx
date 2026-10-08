import {
  type AdapterObservability,
  builtInAdapterRegistry,
  type HookInstallStatus,
} from "@agentyx/adapters";
import {
  builtInMcpServerRegistry,
  builtInPackRegistry,
  type CapabilityProvenance,
  computeHarnessFootprint,
  computeUtilization,
  deriveCapabilityProvenance,
  type HarnessFootprint,
  type HarnessObservation,
  type PackRegistry,
  type ResolvedAgentyxConfig,
  readObservations,
  type UtilizationReport,
} from "@agentyx/core";
import type { DoctorDiagnostic } from "./doctor.js";

/** Show the pack-breadth note only when at least this many configured packs are not recommended. */
const BREADTH_NOTE_MIN_ADDITIONAL = 3;

export interface ObservationProviderReport {
  readonly id: string;
  readonly name: string;
  readonly observability: AdapterObservability;
  /** How much of a session this provider lets Agentyx see. */
  readonly visibility: "strong" | "partial" | "unavailable";
  readonly runtimeObservation: "available" | "unavailable";
  readonly reason: string | undefined;
  readonly hooks: HookInstallStatus | undefined;
  /** Distinct recorded sessions for this provider. */
  readonly sessions: number;
  /** The most recent context size this provider itself reported; not an Agentyx estimate. */
  readonly lastReportedContextTokens: number | undefined;
}

export interface HarnessSection {
  readonly footprint: HarnessFootprint;
}

export interface ObservationSection {
  readonly sessions: number;
  readonly store: { readonly location: "git-local" | "unavailable"; readonly file: string };
  readonly providers: readonly ObservationProviderReport[];
  /** What the percentages mean, so no consumer has to guess. */
  readonly semantics: string;
}

export interface HarnessReports {
  readonly harness: HarnessSection;
  readonly observation: ObservationSection;
  readonly utilization: UtilizationReport;
}

export const OBSERVED_SESSION_RATE_SEMANTICS =
  "observedSessionRate = sessions in which activity was observed / sessions that gave Agentyx " +
  "enough telemetry to see it. It is not a token, cost or context-window share, and not a measure " +
  "of usefulness.";

export interface HarnessInput {
  readonly cwd: string;
  readonly resolved: ResolvedAgentyxConfig | undefined;
  readonly configuredPacks: readonly string[];
  readonly recommendedPacks: readonly string[];
  readonly targets: readonly string[];
  readonly packRegistry: PackRegistry | undefined;
  readonly diagnostics: DoctorDiagnostic[];
}

export async function buildHarnessReports(input: HarnessInput): Promise<HarnessReports> {
  const { resolved } = input;
  const packRegistry = input.packRegistry ?? builtInPackRegistry;
  const provenance: readonly CapabilityProvenance[] =
    resolved === undefined ? [] : deriveCapabilityProvenance(resolved.resolvedPacks, packRegistry);
  const footprint = computeHarnessFootprint({
    configuredPacks: input.configuredPacks,
    recommendedPacks: input.recommendedPacks,
    resolvedPacks: resolved?.resolvedPacks ?? [],
    skills: resolved?.skills ?? [],
    activeMcp: resolved?.mcpServers ?? [],
    declaredMcp: resolved?.declaredMcpServers.length ?? 0,
    activeTools: resolved?.tools.length ?? 0,
    declaredTools: resolved?.declaredTools.length ?? 0,
    activeHooks: resolved?.hooks.length ?? 0,
    declaredHooks: resolved?.declaredHooks.length ?? 0,
    provenance,
    mcpRegistry: builtInMcpServerRegistry,
  });

  const { available, observations } = await readObservations(input.cwd);
  const knownTargets = input.targets.filter((target) => builtInAdapterRegistry.has(target));
  const providers = await Promise.all(
    knownTargets.map((target) => describeProvider(input.cwd, target, observations)),
  );
  const active = new Set([
    ...(resolved?.skills ?? []).map((name) => `skill:${name}`),
    ...(resolved?.mcpServers ?? []).map((name) => `mcp:${name}`),
    ...(resolved?.tools ?? []).map((name) => `tool:${name}`),
  ]);
  const utilization = computeUtilization({
    observations,
    providers: builtInAdapterRegistry.ids.map((id) => {
      const observability = builtInAdapterRegistry.get(id).capabilities.observability;

      return { id, skills: observability?.skillUse === true, mcp: observability?.mcpUse === true };
    }),
    targets: knownTargets,
    capabilities: provenance
      .filter((capability) => active.has(`${capability.kind}:${capability.name}`))
      .map((capability) => ({
        ...capability,
        contextCost:
          capability.kind === "mcp" && builtInMcpServerRegistry.has(capability.name)
            ? builtInMcpServerRegistry.get(capability.name).contextCost
            : undefined,
      })),
    resolvedPacks: resolved?.resolvedPacks ?? [],
  });

  addRecommendations(input.diagnostics, footprint, utilization, providers);

  return {
    harness: { footprint },
    observation: {
      sessions: utilization.sessions,
      store: { location: available ? "git-local" : "unavailable", file: "usage-v1.jsonl" },
      providers,
      semantics: OBSERVED_SESSION_RATE_SEMANTICS,
    },
    utilization,
  };
}

async function describeProvider(
  cwd: string,
  target: string,
  observations: readonly HarnessObservation[],
): Promise<ObservationProviderReport> {
  const adapter = builtInAdapterRegistry.get(target);
  const observability: AdapterObservability = adapter.capabilities.observability ?? {
    projectHooks: false,
    sessionLifecycle: false,
    toolUse: false,
    skillUse: false,
    mcpUse: false,
    contextTokens: false,
  };
  const own = observations.filter((observation) => observation.provider === target);
  const reported = own.filter((observation) => observation.contextTokens !== undefined).at(-1);
  const runtime = observability.projectHooks && observability.sessionLifecycle;

  return {
    id: target,
    name: adapter.name,
    observability,
    visibility: !runtime
      ? "unavailable"
      : observability.skillUse && observability.mcpUse
        ? "strong"
        : "partial",
    runtimeObservation: runtime ? "available" : "unavailable",
    reason: observability.reason,
    hooks: await adapter.inspectHooks?.(cwd),
    sessions: new Set(own.map((observation) => observation.session)).size,
    lastReportedContextTokens: reported?.contextTokens,
  };
}

function addRecommendations(
  diagnostics: DoctorDiagnostic[],
  footprint: HarnessFootprint,
  utilization: UtilizationReport,
  providers: readonly ObservationProviderReport[],
): void {
  for (const capability of utilization.capabilities) {
    if (
      capability.kind !== "mcp" ||
      capability.state !== "dormant-candidate" ||
      capability.contextCost === undefined ||
      capability.contextCost === "low"
    ) {
      continue;
    }

    diagnostics.push({
      level: "info",
      code: "dormant_mcp_candidate",
      message:
        `MCP server "${capability.name}" is active, ${capability.contextCost}-context, and has no ` +
        `observed calls in ${capability.eligibleSessions} observable sessions. Consider disabling ` +
        "it if it is not part of this project's normal agent workflow.",
    });
  }

  const { breadth } = footprint;

  if (breadth.additional.length >= BREADTH_NOTE_MIN_ADDITIONAL) {
    diagnostics.push({
      level: "info",
      code: "pack_breadth",
      message:
        `${breadth.configured} packs are configured while project detection currently recommends ` +
        `${breadth.recommended}. The other ${breadth.additional.length} (${breadth.additional.join(", ")}) ` +
        "may be intentional workflow choices; review them if you want a leaner harness.",
    });
  }

  for (const provider of providers) {
    if (provider.runtimeObservation === "unavailable") {
      diagnostics.push({
        level: "info",
        code: "runtime_observation_unavailable",
        message: `Runtime observation is unavailable for ${provider.name}: ${provider.reason ?? "no project-local hooks."}`,
      });
    }

    if (provider.hooks?.note !== undefined) {
      diagnostics.push({
        level: "info",
        code: "observer_hooks_not_installed",
        message: `${provider.name}: ${provider.hooks.note}`,
      });
    }
  }
}
