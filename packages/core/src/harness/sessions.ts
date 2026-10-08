import type { HarnessObservation } from "./observation.js";

/**
 * How a recorded session relates to the current harness baseline.
 *
 * - `current`: a valid `session-start` stamped it with the current baseline.
 * - `historical`: it started under a different baseline.
 * - `unbaselined`: no usable baseline — no `session-start` was recorded, the installed harness could
 *   not be determined, or the session's starts disagree. It is never negative evidence.
 */
export type SessionStanding = "current" | "historical" | "unbaselined";

export interface SessionSummary {
  readonly provider: string;
  readonly session: string;
  readonly standing: SessionStanding;
  /** `capabilityKind:capability` → observed calls. */
  readonly hits: ReadonlyMap<string, number>;
  /** Latest provider-reported context size in the session, if any. */
  readonly contextTokens: number | undefined;
  readonly lastSeen: string;
}

/**
 * Groups observations into sessions and decides which of them belong to `currentBaseline`.
 *
 * A session has a baseline only when every `session-start` it recorded names the same one. Repeated
 * identical starts (a resumed session) are fine; a missing, baseline-less or conflicting start makes
 * the session `unbaselined`, so incomplete data can never turn into a false "unused".
 */
export function summarizeSessions(
  observations: readonly HarnessObservation[],
  currentBaseline: string | undefined,
): SessionSummary[] {
  const groups = new Map<
    string,
    {
      provider: string;
      session: string;
      starts: Set<string | undefined>;
      hits: Map<string, number>;
      context: { at: string; tokens: number } | undefined;
      lastSeen: string;
    }
  >();

  for (const observation of observations) {
    const key = `${observation.provider}:${observation.session}`;
    const group = groups.get(key) ?? {
      provider: observation.provider,
      session: observation.session,
      starts: new Set(),
      hits: new Map(),
      context: undefined,
      lastSeen: observation.timestamp,
    };

    groups.set(key, group);

    if (observation.event === "session-start") {
      group.starts.add(observation.baseline);
    }

    if (observation.capabilityKind !== undefined && observation.capability !== undefined) {
      const hit = `${observation.capabilityKind}:${observation.capability}`;

      group.hits.set(hit, (group.hits.get(hit) ?? 0) + (observation.count ?? 1));
    }

    if (
      observation.contextTokens !== undefined &&
      (group.context === undefined || group.context.at <= observation.timestamp)
    ) {
      group.context = { at: observation.timestamp, tokens: observation.contextTokens };
    }

    if (group.lastSeen < observation.timestamp) {
      group.lastSeen = observation.timestamp;
    }
  }

  return [...groups.values()].map((group) => {
    const [only] = group.starts.size === 1 ? [...group.starts] : [];
    const standing: SessionStanding =
      only === undefined ? "unbaselined" : only === currentBaseline ? "current" : "historical";

    return {
      provider: group.provider,
      session: group.session,
      standing,
      hits: group.hits,
      contextTokens: group.context?.tokens,
      lastSeen: group.lastSeen,
    };
  });
}
