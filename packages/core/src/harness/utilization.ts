import type { HarnessObservation } from "./observation.js";
import type { CapabilityKind, CapabilityProvenance } from "./provenance.js";
import { type SessionSummary, summarizeSessions } from "./sessions.js";

/**
 * Minimum observable sessions before a capability can be called a dormant candidate.
 *
 * A heuristic, not a scientific constant: ten is enough that "never used" is unlikely to be a
 * coincidence of a few short sessions. Change it here and nowhere else.
 */
export const DORMANCY_MIN_SESSIONS = 10;

/** What a provider can reliably show Agentyx, as reported by its adapter. */
export interface ProviderVisibility {
  readonly id: string;
  readonly skills: boolean;
  readonly mcp: boolean;
  /**
   * Agentyx's observer hooks are currently installed for this provider. A provider that supports
   * observation but is not being observed cannot show that anything went unused.
   */
  readonly observing: boolean;
}

export type Evidence = "strong" | "partial" | "unavailable";

export type CapabilityState =
  /** Used at least once in a session where it could be seen. */
  | "observed"
  /** Activity of this kind cannot be seen by any configured provider. Says nothing about use. */
  | "unobservable"
  /**
   * Observable, never seen, but the installed harness is behind `.agentyx.json`: negative evidence
   * is withheld until `agentyx install` makes them converge.
   */
  | "paused-pending-install"
  /** Observable, but no session in the current baseline yet. */
  | "no-data"
  /** Observable, never seen, but fewer sessions than {@link DORMANCY_MIN_SESSIONS}. */
  | "insufficient-sample"
  /** Active, reliably observable, enough sessions, no observed use. */
  | "dormant-candidate";

export interface UtilizationCapability {
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly packs: readonly string[];
  readonly contextCost: "low" | "medium" | "high" | undefined;
  readonly state: CapabilityState;
  readonly observedSessions: number;
  readonly eligibleSessions: number;
  /** observedSessions / eligibleSessions; `null` when there is no denominator. NOT a token share. */
  readonly observedSessionRate: number | null;
  readonly observedCalls: number;
}

export interface UtilizationPack {
  readonly name: string;
  readonly evidence: Evidence;
  /** Names of the pack's active capabilities that were seen. */
  readonly observedCapabilities: readonly string[];
  readonly observedSessions: number;
  readonly eligibleSessions: number;
  /** Only for `strong` evidence: partial data does not get a forced percentage. */
  readonly observedSessionRate: number | null;
}

export interface UtilizationObservationCounts {
  readonly totalSessions: number;
  readonly currentBaselineSessions: number;
  /** Sessions recorded under a different harness; ignored for every current-harness conclusion. */
  readonly ignoredHistoricalSessions: number;
  /** Sessions with no usable baseline (no session-start, undetermined or conflicting harness). */
  readonly unbaselinedSessions: number;
}

export interface UtilizationReport {
  /** All recorded sessions, whatever their baseline. */
  readonly sessions: number;
  readonly observation: UtilizationObservationCounts;
  /** Negative evidence is `paused-pending-install` while installed state trails configuration. */
  readonly negativeEvidence: "enabled" | "paused-pending-install";
  readonly minSessionsForDormancy: number;
  readonly packs: readonly UtilizationPack[];
  readonly capabilities: readonly UtilizationCapability[];
}

export interface UtilizationInput {
  readonly observations: readonly HarnessObservation[];
  /** Visibility of every provider that may have contributed sessions. */
  readonly providers: readonly ProviderVisibility[];
  /** Providers the project is configured for; decides what is observable at all. */
  readonly targets: readonly string[];
  /** Active capabilities only. */
  readonly capabilities: readonly (CapabilityProvenance & {
    readonly contextCost?: "low" | "medium" | "high" | undefined;
  })[];
  readonly resolvedPacks: readonly string[];
  readonly minSessions?: number;
  /**
   * The fingerprint of the harness the provider is running now. `undefined` when it cannot be
   * determined: then no session is current and nothing can be negative evidence.
   */
  readonly currentBaseline?: string | undefined;
  /** `.agentyx.json` asks for a harness that `agentyx install` has not installed yet. */
  readonly installationPending?: boolean;
}

/**
 * Whether a provider can reliably show that something of this kind was NOT used.
 *
 * Tools are never absence-reliable: RTK would have to be recognized from shell command text, which
 * Agentyx refuses to store and will not guess at, so a tool can be seen but never ruled out.
 */
function sees(provider: ProviderVisibility | undefined, kind: CapabilityKind): boolean {
  if (provider === undefined || !provider.observing) {
    return false;
  }

  return kind === "skill" ? provider.skills : kind === "mcp" ? provider.mcp : false;
}

/**
 * Observed-session rates for the CURRENT harness only.
 *
 * Invariant: a session counts toward a capability's `eligibleSessions` only if (1) it was stamped
 * with the current baseline by a valid `session-start`, (2) the capability is part of that harness,
 * (3) the session's provider reliably observes that kind and its observer hooks are installed, and
 * (4) installation is not pending. Only then does absence mean "Agentyx could see it and it did not
 * happen". Historical and unbaselined sessions never reach a denominator.
 */
export function computeUtilization(input: UtilizationInput): UtilizationReport {
  const min = input.minSessions ?? DORMANCY_MIN_SESSIONS;
  const providers = new Map(input.providers.map((provider) => [provider.id, provider]));
  const all = summarizeSessions(input.observations, input.currentBaseline);
  const sessions: SessionSummary[] = all.filter((session) => session.standing === "current");
  const paused = input.installationPending === true;
  const observation: UtilizationObservationCounts = {
    totalSessions: all.length,
    currentBaselineSessions: sessions.length,
    ignoredHistoricalSessions: all.filter((session) => session.standing === "historical").length,
    unbaselinedSessions: all.filter((session) => session.standing === "unbaselined").length,
  };

  const configured = input.targets
    .map((target) => providers.get(target))
    .filter((provider) => provider !== undefined);
  const observable = (kind: CapabilityKind): boolean =>
    configured.some((provider) => sees(provider, kind));

  const capabilities: UtilizationCapability[] = input.capabilities
    .filter((capability) => capability.kind !== "hook")
    .map((capability) => {
      const hit = `${capability.kind}:${capability.name}`;
      let eligible = 0;
      let observed = 0;
      let calls = 0;

      for (const session of sessions) {
        const count = session.hits.get(hit) ?? 0;

        calls += count;

        if (!sees(providers.get(session.provider), capability.kind)) {
          // Positive evidence still counts for kinds that cannot be ruled out (tools).
          observed += capability.kind === "tool" && count > 0 ? 1 : 0;
          continue;
        }

        if (paused) {
          observed += count > 0 ? 1 : 0;
          continue;
        }

        eligible += 1;
        observed += count > 0 ? 1 : 0;
      }

      const state: CapabilityState =
        observed > 0
          ? "observed"
          : !observable(capability.kind)
            ? "unobservable"
            : paused
              ? "paused-pending-install"
              : eligible === 0
                ? "no-data"
                : eligible < min
                  ? "insufficient-sample"
                  : "dormant-candidate";

      return {
        kind: capability.kind,
        name: capability.name,
        packs: capability.packs,
        contextCost: capability.contextCost,
        state,
        observedSessions: observed,
        eligibleSessions: eligible,
        observedSessionRate: eligible > 0 ? rate(Math.min(observed, eligible), eligible) : null,
        observedCalls: calls,
      };
    });

  const packs: UtilizationPack[] = input.resolvedPacks.map((name) => {
    const members = capabilities.filter((capability) => capability.packs.includes(name));
    const observableMembers = members.filter((member) => member.state !== "unobservable");
    const evidence: Evidence =
      members.length === 0 || observableMembers.length === 0
        ? "unavailable"
        : observableMembers.length === members.length
          ? "strong"
          : "partial";
    const kinds = new Set(members.map((member) => member.kind));
    const needed = [...kinds].filter((kind) => evidence === "strong" || observable(kind));
    let eligible = 0;
    let observed = 0;

    for (const session of sessions) {
      const provider = providers.get(session.provider);
      const visible =
        !paused &&
        (evidence === "strong"
          ? needed.every((kind) => sees(provider, kind))
          : needed.some((kind) => sees(provider, kind)));
      const used = members.some((member) => session.hits.has(`${member.kind}:${member.name}`));

      if (visible) {
        eligible += 1;
        observed += used ? 1 : 0;
      } else if (used && evidence !== "unavailable") {
        observed += 1;
      }
    }

    return {
      name,
      evidence,
      observedCapabilities: members
        .filter((member) => member.state === "observed")
        .map((member) => member.name),
      observedSessions: evidence === "unavailable" ? 0 : observed,
      eligibleSessions: evidence === "unavailable" ? 0 : eligible,
      observedSessionRate:
        evidence === "strong" && eligible > 0 ? rate(Math.min(observed, eligible), eligible) : null,
    };
  });

  return {
    sessions: all.length,
    observation,
    negativeEvidence: paused ? "paused-pending-install" : "enabled",
    minSessionsForDormancy: min,
    packs,
    capabilities,
  };
}

function rate(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}
