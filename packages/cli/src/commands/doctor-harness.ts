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
  type InstallManifest,
  type PackRegistry,
  type ResolvedAgentyxConfig,
  readObservations,
  type SessionSummary,
  summarizeSessions,
  USAGE_FILE_NAME,
  type UtilizationReport,
} from "@agentyx/core";
import type { DoctorDiagnostic } from "./doctor.js";
import { installedHarnessBaseline } from "./harness-baseline.js";

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
  /**
   * Whether Agentyx's observer hooks are currently in place for this provider: `active`,
   * `partial` (configured, but nothing confirms the provider ran them yet — Codex may need the
   * user to trust them), or `unavailable` (no runtime hooks, or not configured). A provider that
   * merely supports hooks is not covered.
   */
  readonly coverage: "active" | "partial" | "unavailable";
  /** Distinct recorded sessions for this provider, whatever harness they ran under. */
  readonly sessions: number;
  /** The subset of {@link sessions} that ran under the current harness baseline. */
  readonly currentBaselineSessions: number;
  /**
   * The most recent context size this provider itself reported in a CURRENT-baseline session; not
   * an Agentyx estimate. Sizes from older harnesses are never shown as describing this one.
   */
  readonly lastReportedContextTokens: number | undefined;
}

export interface HarnessSection {
  readonly footprint: HarnessFootprint;
}

export interface ObservationSection {
  /** All recorded sessions, whatever their baseline. */
  readonly sessions: number;
  /**
   * The harness baseline sessions are compared against: the INSTALLED harness (from
   * `.agentyx.lock.json`). `fingerprint` is `null` when nothing is installed.
   */
  readonly currentBaseline: {
    readonly fingerprint: string | null;
    readonly sessions: number;
  };
  /** Sessions recorded under a different harness; ignored for current usage conclusions. */
  readonly historicalSessions: number;
  /** Sessions with no usable baseline; also ignored for current usage conclusions. */
  readonly unbaselinedSessions: number;
  /** `paused-pending-install` while `.agentyx.json` is ahead of what is installed. */
  readonly negativeEvidence: UtilizationReport["negativeEvidence"];
  readonly store: {
    readonly location: "git-local" | "unavailable";
    readonly file: string;
    /** The store file exists (it may hold no valid record). */
    readonly present: boolean;
    /** An earlier-format file exists beside the store and is ignored. */
    readonly legacyData: boolean;
  };
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
  readonly manifest: InstallManifest;
  /** `.agentyx.json` asks for a harness that is not installed yet. */
  readonly installationPending: boolean;
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

  const { available, present, legacyData, observations } = await readObservations(input.cwd);
  const currentBaseline = installedHarnessBaseline(input.manifest)?.fingerprint;
  const sessionSummaries = summarizeSessions(observations, currentBaseline);
  const knownTargets = input.targets.filter((target) => builtInAdapterRegistry.has(target));
  const providers = await Promise.all(
    knownTargets.map((target) => describeProvider(input.cwd, target, sessionSummaries)),
  );
  const observing = new Set(
    providers.filter((provider) => provider.coverage !== "unavailable").map(({ id }) => id),
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

      return {
        id,
        skills: observability?.skillUse === true,
        mcp: observability?.mcpUse === true,
        observing: observing.has(id),
      };
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
    currentBaseline,
    installationPending: input.installationPending,
  });

  addRecommendations(
    input.diagnostics,
    footprint,
    utilization,
    providers,
    input.installationPending,
  );

  return {
    harness: { footprint },
    observation: {
      sessions: utilization.sessions,
      currentBaseline: {
        fingerprint: currentBaseline ?? null,
        sessions: utilization.observation.currentBaselineSessions,
      },
      historicalSessions: utilization.observation.ignoredHistoricalSessions,
      unbaselinedSessions: utilization.observation.unbaselinedSessions,
      negativeEvidence: utilization.negativeEvidence,
      store: {
        location: available ? "git-local" : "unavailable",
        file: USAGE_FILE_NAME,
        present,
        legacyData,
      },
      providers,
      semantics: OBSERVED_SESSION_RATE_SEMANTICS,
    },
    utilization,
  };
}

async function describeProvider(
  cwd: string,
  target: string,
  sessions: readonly SessionSummary[],
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
  const own = sessions.filter((session) => session.provider === target);
  const current = own.filter((session) => session.standing === "current");
  const reported = current
    .filter((session) => session.contextTokens !== undefined)
    .sort((left, right) =>
      left.lastSeen < right.lastSeen ? -1 : left.lastSeen > right.lastSeen ? 1 : 0,
    )
    .at(-1);
  const runtime = observability.projectHooks && observability.sessionLifecycle;
  const hooks = await adapter.inspectHooks?.(cwd);
  const coverage: ObservationProviderReport["coverage"] =
    !runtime || hooks?.configured !== true
      ? "unavailable"
      : hooks.trust === "review-may-be-required" && current.length === 0
        ? "partial"
        : "active";

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
    hooks,
    coverage,
    sessions: own.length,
    currentBaselineSessions: current.length,
    lastReportedContextTokens: reported?.contextTokens,
  };
}

function addRecommendations(
  diagnostics: DoctorDiagnostic[],
  footprint: HarnessFootprint,
  utilization: UtilizationReport,
  providers: readonly ObservationProviderReport[],
  installationPending: boolean,
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
        `observed calls in ${capability.eligibleSessions} current-harness observable sessions. Consider disabling ` +
        "it if it is not part of this project's normal agent workflow.",
    });
  }

  const { observation } = utilization;

  if (
    !installationPending &&
    observation.currentBaselineSessions === 0 &&
    observation.ignoredHistoricalSessions + observation.unbaselinedSessions > 0
  ) {
    diagnostics.push({
      level: "info",
      code: "observation_baseline_reset",
      message:
        "Harness configuration changed since the previous observations. Usage recommendations " +
        "need new sessions before dormant capabilities can be evaluated.",
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
