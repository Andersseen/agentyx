import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  builtInMcpServerRegistry,
  builtInPackRegistry,
  compactObservations,
  computeHarnessFootprint,
  computeHarnessObservationBaseline,
  computeUtilization,
  DORMANCY_MIN_SESSIONS,
  deriveCapabilityProvenance,
  HARNESS_OBSERVATION_CONTRACT_VERSION,
  type HarnessObservation,
  hashSessionKey,
  installedCapabilities,
  MAX_RETAINED_SESSIONS,
  OBSERVATION_VERSION,
  parseObservationLine,
  readObservations,
  recordObservation,
  resolvePacks,
  resolveUsageFile,
} from "../src/index.js";

const BASE = "a1b2c3d4e5f60718";
const OTHER = "ffffffffffffffff";
const claude = { id: "claude", skills: true, mcp: true, observing: true };
const codex = { id: "codex", skills: false, mcp: true, observing: true };
const kimi = { id: "kimi", skills: false, mcp: false, observing: false };

function observation(
  provider: string,
  n: number,
  extra: Partial<HarnessObservation> = {},
): HarnessObservation {
  return {
    version: OBSERVATION_VERSION,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    provider,
    session: hashSessionKey(provider, `s${n}`),
    event: "session-start",
    ...(extra.event === undefined || extra.event === "session-start" ? { baseline: BASE } : {}),
    ...extra,
  };
}

function sessions(
  provider: string,
  count: number,
  mcpFor: readonly number[] = [],
  baseline: string = BASE,
  offset = 0,
) {
  return Array.from({ length: count }, (_, i) => [
    observation(provider, i + offset, { baseline }),
    ...(mcpFor.includes(i)
      ? [
          observation(provider, i + offset, {
            event: "mcp-used",
            capabilityKind: "mcp",
            capability: "playwright",
          }),
        ]
      : []),
  ]).flat();
}

const playwright = {
  kind: "mcp" as const,
  name: "playwright",
  packs: ["testing"],
  activation: "optional" as const,
  contextCost: "high" as const,
};

function utilization(
  observations: readonly HarnessObservation[],
  targets = ["claude"],
  extra: Partial<Parameters<typeof computeUtilization>[0]> = {},
) {
  return computeUtilization({
    currentBaseline: BASE,
    observations,
    providers: [claude, codex, kimi],
    targets,
    capabilities: [
      playwright,
      { kind: "skill", name: "angular-modern", packs: ["angular"], activation: "default" },
      { kind: "tool", name: "rtk", packs: ["efficiency"], activation: "optional" },
    ],
    resolvedPacks: ["angular", "testing", "efficiency"],
    ...extra,
  });
}

describe("observation parsing", () => {
  it("accepts a valid record and rejects malformed or over-rich ones", () => {
    const valid = observation("claude", 1);

    expect(parseObservationLine(JSON.stringify(valid))).toEqual(valid);
    expect(parseObservationLine("not json")).toBeUndefined();
    expect(parseObservationLine("")).toBeUndefined();
    expect(parseObservationLine(JSON.stringify({ ...valid, event: "prompt" }))).toBeUndefined();
    expect(
      parseObservationLine(JSON.stringify({ ...valid, session: "raw-provider-id" })),
    ).toBeUndefined();
    // Strict: a record carrying a prompt, command or tool payload is rejected whole.
    for (const extra of ["prompt", "command", "tool_input", "tool_response", "transcript_path"]) {
      expect(parseObservationLine(JSON.stringify({ ...valid, [extra]: "secret" }))).toBeUndefined();
    }
  });

  it("hashes session ids deterministically and opaquely", () => {
    expect(hashSessionKey("claude", "abc")).toBe(hashSessionKey("claude", "abc"));
    expect(hashSessionKey("claude", "abc")).not.toBe(hashSessionKey("codex", "abc"));
    expect(hashSessionKey("claude", "abc")).toMatch(/^[0-9a-f]{16}$/);
    expect(hashSessionKey("claude", "abc")).not.toContain("abc");
  });
});

describe("capability provenance", () => {
  it("counts a capability shared by two packs once, listing both packs", () => {
    const packs = resolvePacks(["performance", "accessibility"], builtInPackRegistry);
    const provenance = deriveCapabilityProvenance(packs, builtInPackRegistry);
    const devtools = provenance.filter((entry) => entry.name === "chrome-devtools");

    expect(devtools).toHaveLength(1);
    expect(devtools[0]).toMatchObject({ kind: "mcp", packs: ["performance", "accessibility"] });

    const footprint = computeHarnessFootprint({
      configuredPacks: ["performance", "accessibility"],
      recommendedPacks: [],
      resolvedPacks: packs,
      skills: [],
      activeMcp: ["chrome-devtools"],
      declaredMcp: 1,
      activeTools: 0,
      declaredTools: 0,
      activeHooks: 0,
      declaredHooks: 0,
      provenance,
      mcpRegistry: builtInMcpServerRegistry,
    });

    expect(footprint.mcp.active).toBe(1);
    expect(footprint.contextSurface.high).toBe(1);
    expect(footprint.contextSurface.servers[0]?.packs).toEqual(["performance", "accessibility"]);
    expect(footprint.breadth.additional).toEqual(["performance", "accessibility"]);
  });
});

describe("utilization", () => {
  it("reports no data without sessions, and never calls anything dormant", () => {
    const report = utilization([]);
    const mcp = report.capabilities.find((capability) => capability.name === "playwright");

    expect(report.sessions).toBe(0);
    expect(mcp).toMatchObject({ state: "no-data", observedSessionRate: null });
  });

  it("does not classify as dormant below the sample threshold", () => {
    const report = utilization(sessions("claude", DORMANCY_MIN_SESSIONS - 1));

    expect(report.capabilities.find((c) => c.name === "playwright")?.state).toBe(
      "insufficient-sample",
    );
  });

  it("flags a never-seen MCP as a dormant candidate over a meaningful sample", () => {
    const report = utilization(sessions("claude", 12));
    const mcp = report.capabilities.find((c) => c.name === "playwright");

    expect(mcp).toMatchObject({
      state: "dormant-candidate",
      observedSessions: 0,
      eligibleSessions: 12,
      observedSessionRate: 0,
    });
  });

  it("exposes numerator and denominator for a used MCP and does not flag it", () => {
    const report = utilization(sessions("claude", 10, [0, 1, 2, 3, 4, 5]));
    const mcp = report.capabilities.find((c) => c.name === "playwright");

    expect(mcp).toMatchObject({
      state: "observed",
      observedSessions: 6,
      eligibleSessions: 10,
      observedSessionRate: 0.6,
    });
    expect(report.packs.find((pack) => pack.name === "testing")).toMatchObject({
      observedSessions: 6,
      eligibleSessions: 10,
    });
  });

  it("never reports unobservable Skills as unused", () => {
    const report = utilization(sessions("codex", 20), ["codex"]);
    const skill = report.capabilities.find((c) => c.name === "angular-modern");

    expect(skill?.state).toBe("unobservable");
    expect(skill?.observedSessionRate).toBeNull();
    expect(report.packs.find((pack) => pack.name === "angular")?.evidence).toBe("unavailable");
  });

  it("never rules out a tool, even over many sessions", () => {
    const report = utilization(sessions("claude", 30));

    expect(report.capabilities.find((c) => c.name === "rtk")?.state).toBe("unobservable");
    expect(report.packs.find((pack) => pack.name === "efficiency")?.evidence).toBe("unavailable");
  });

  it("gives a partial pack no forced percentage, and a strong pack one", () => {
    const report = computeUtilization({
      observations: sessions("claude", 4, [0]),
      providers: [claude],
      targets: ["claude"],
      capabilities: [
        playwright,
        { kind: "tool", name: "rtk", packs: ["testing"], activation: "optional" },
      ],
      resolvedPacks: ["testing"],
      currentBaseline: BASE,
    });
    const testing = report.packs[0];

    expect(testing?.evidence).toBe("partial");
    expect(testing?.observedSessionRate).toBeNull();
    expect(testing?.observedSessions).toBe(1);

    const strong = utilization(sessions("claude", 4, [0])).packs.find((p) => p.name === "testing");

    expect(strong).toMatchObject({ evidence: "strong", observedSessionRate: 0.25 });
  });

  it("only counts sessions that could show the capability", () => {
    const report = utilization(
      [...sessions("claude", 6), ...sessions("kimi", 6)],
      ["claude", "kimi"],
    );

    expect(report.sessions).toBe(12);
    expect(report.capabilities.find((c) => c.name === "playwright")?.eligibleSessions).toBe(6);
  });

  it("mixes Claude and Codex sessions by each provider's visibility", () => {
    const report = utilization(
      [...sessions("claude", 5, [0]), ...sessions("codex", 5, [0])],
      ["claude", "codex"],
    );

    expect(report.capabilities.find((c) => c.name === "playwright")).toMatchObject({
      observedSessions: 2,
      eligibleSessions: 10,
    });
    expect(report.capabilities.find((c) => c.name === "angular-modern")).toMatchObject({
      eligibleSessions: 5,
    });
  });
});

describe("bounded storage", () => {
  it("keeps only the most recent sessions and collapses repeats", () => {
    const many = Array.from({ length: MAX_RETAINED_SESSIONS + 10 }, (_, n) =>
      observation("claude", n),
    );
    const repeats = Array.from({ length: 5 }, () =>
      observation("claude", 100, {
        event: "mcp-used",
        capabilityKind: "mcp",
        capability: "context7",
      }),
    );
    const compacted = compactObservations([...many, ...repeats]);
    const keys = new Set(compacted.map((o) => o.session));

    expect(keys.size).toBe(MAX_RETAINED_SESSIONS);
    expect(compacted.find((o) => o.capability === "context7")?.count).toBe(5);
    expect(keys.has(hashSessionKey("claude", "s0"))).toBe(false);
  });

  it("drops the oldest sessions to fit a byte limit", () => {
    const list = Array.from({ length: 20 }, (_, n) => observation("claude", n));
    const compacted = compactObservations(list, { sessions: 50, bytes: 700 });

    expect(compacted.length).toBeGreaterThan(0);
    expect(compacted.length).toBeLessThan(20);
    expect(compacted.at(-1)?.session).toBe(hashSessionKey("claude", "s19"));
  });
});

describe("usage state location", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agentyx-usage-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("uses .git/agentyx for an ordinary repository, from a subdirectory too", async () => {
    await mkdir(join(dir, ".git"));
    await mkdir(join(dir, "sub"));

    expect(await resolveUsageFile(join(dir, "sub"))).toBe(
      join(dir, ".git", "agentyx", "usage-v2.jsonl"),
    );
  });

  it("follows a .git file (linked worktree) instead of assuming a directory", async () => {
    const real = join(dir, "main", ".git", "worktrees", "wt");
    const worktree = join(dir, "wt");

    await mkdir(real, { recursive: true });
    await mkdir(worktree);
    await writeFile(join(worktree, ".git"), `gitdir: ${real}\n`, "utf8");

    expect(await resolveUsageFile(worktree)).toBe(join(real, "agentyx", "usage-v2.jsonl"));
  });

  it("has no location outside a Git checkout, and never falls back to $HOME", async () => {
    expect(await resolveUsageFile(dir)).toBeUndefined();
    expect(await recordObservation(dir, observation("claude", 1))).toBe(false);
  });

  it("round-trips observations and tolerates garbage lines", async () => {
    await mkdir(join(dir, ".git"));
    await recordObservation(dir, observation("claude", 1));
    await recordObservation(dir, observation("claude", 2, { event: "session-end" }));

    const file = join(dir, ".git", "agentyx", "usage-v2.jsonl");

    await writeFile(file, `${await readFile(file, "utf8")}garbage\n`, "utf8");

    const { observations } = await readObservations(dir);

    expect(observations).toHaveLength(2);
    expect((await stat(file)).size).toBeLessThan(2048);
  });
});

describe("configuration-aware utilization", () => {
  const playwrightOf = (report: ReturnType<typeof utilization>) =>
    report.capabilities.find((c) => c.name === "playwright");

  it("A: sessions from before a capability was active never enter its denominator", () => {
    const report = utilization([
      ...sessions("claude", 20, [], OTHER),
      ...sessions("claude", 1, [], BASE, 100),
    ]);

    expect(playwrightOf(report)).toMatchObject({
      state: "insufficient-sample",
      eligibleSessions: 1,
    });
    expect(report.observation).toMatchObject({
      totalSessions: 21,
      currentBaselineSessions: 1,
      ignoredHistoricalSessions: 20,
    });
  });

  it("B/regression: many historical sessions cannot make a thin current sample dormant", () => {
    const report = utilization([
      ...sessions("claude", 50, [], OTHER),
      ...sessions("claude", 2, [], BASE, 100),
    ]);

    expect(playwrightOf(report)?.state).toBe("insufficient-sample");
    expect(playwrightOf(report)?.eligibleSessions).toBe(2);
  });

  it("C: a full current baseline with no calls is a dormant candidate", () => {
    expect(playwrightOf(utilization(sessions("claude", 10)))).toMatchObject({
      state: "dormant-candidate",
      eligibleSessions: 10,
    });
  });

  it("D: rates use current sessions only", () => {
    const report = utilization([
      ...sessions("claude", 10, [0, 1, 2, 3]),
      ...sessions("claude", 30, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], OTHER, 100),
    ]);

    expect(playwrightOf(report)).toMatchObject({
      state: "observed",
      observedSessions: 4,
      eligibleSessions: 10,
      observedSessionRate: 0.4,
      observedCalls: 4,
    });
  });

  it("E: with no current sessions (legacy or reset) nothing is dormant", () => {
    const report = utilization(sessions("claude", 20, [], OTHER));

    expect(playwrightOf(report)).toMatchObject({ state: "no-data", eligibleSessions: 0 });
    expect(report.observation.currentBaselineSessions).toBe(0);
  });

  it("is never dormant when the current baseline cannot be determined", () => {
    const report = utilization(sessions("claude", 20), ["claude"], { currentBaseline: undefined });

    expect(playwrightOf(report)?.state).toBe("no-data");
  });

  it("incomplete sessions are never negative evidence", () => {
    const orphanUse = observation("claude", 500, {
      event: "mcp-used",
      capabilityKind: "mcp",
      capability: "playwright",
    });
    const orphanEnd = observation("claude", 501, { event: "session-end" });
    const unstamped = observation("claude", 502, { baseline: undefined });
    const conflicting = [
      observation("claude", 503, { baseline: BASE }),
      observation("claude", 503, { baseline: OTHER }),
    ];
    const report = utilization([orphanUse, orphanEnd, unstamped, ...conflicting]);

    expect(report.observation).toMatchObject({
      currentBaselineSessions: 0,
      unbaselinedSessions: 4,
    });
    expect(playwrightOf(report)).toMatchObject({
      state: "no-data",
      eligibleSessions: 0,
      observedSessions: 0,
      observedCalls: 0,
    });
  });

  it("repeated identical session starts still form one current session", () => {
    const start = observation("claude", 1);
    const report = utilization([start, { ...start, count: 3 }, start]);

    expect(report.observation.currentBaselineSessions).toBe(1);
    expect(playwrightOf(report)?.eligibleSessions).toBe(1);
  });

  it("pauses negative evidence while installation is pending", () => {
    const report = utilization(sessions("claude", 12), ["claude"], { installationPending: true });
    const mcp = playwrightOf(report);

    expect(report.negativeEvidence).toBe("paused-pending-install");
    expect(mcp).toMatchObject({
      state: "paused-pending-install",
      eligibleSessions: 0,
      observedSessionRate: null,
    });
    expect(report.packs.find((p) => p.name === "testing")?.eligibleSessions).toBe(0);
  });

  it("ignores sessions of a provider whose observer hooks are not installed", () => {
    const report = utilization(sessions("codex", 12), ["codex"], {
      providers: [claude, { ...codex, observing: false }, kimi],
    });

    expect(playwrightOf(report)?.state).toBe("unobservable");
    expect(playwrightOf(report)?.eligibleSessions).toBe(0);
  });

  it("only counts sessions of providers that could observe the kind, per baseline", () => {
    const report = utilization(
      [
        ...sessions("claude", 6),
        ...sessions("codex", 6, [], BASE, 50),
        ...sessions("kimi", 6, [], BASE, 90),
      ],
      ["claude", "codex", "kimi"],
    );

    expect(playwrightOf(report)?.eligibleSessions).toBe(12);
    expect(report.capabilities.find((c) => c.name === "angular-modern")?.eligibleSessions).toBe(6);
  });
});

describe("harness observation baseline", () => {
  const provider = {
    id: "claude",
    projectHooks: true,
    sessionLifecycle: true,
    toolUse: true,
    skillUse: true,
    mcpUse: true,
    contextTokens: true,
  };
  const capabilities = [
    { kind: "skill" as const, name: "a", target: "claude" },
    { kind: "mcp" as const, name: "playwright", target: "claude" },
    { kind: "hook" as const, name: "observe", target: "claude" },
  ];
  const base = () => computeHarnessObservationBaseline({ capabilities, providers: [provider] });

  it("is deterministic, short and order/duplicate independent", () => {
    const shuffled = computeHarnessObservationBaseline({
      capabilities: [...capabilities].reverse().concat(capabilities[0] as never),
      providers: [provider, provider],
    });

    expect(base().fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(shuffled).toEqual(base());
  });

  it("changes when a capability, a target or a provider's observability changes", () => {
    const changed = (input: Parameters<typeof computeHarnessObservationBaseline>[0]) =>
      computeHarnessObservationBaseline(input).fingerprint;

    expect(changed({ capabilities: capabilities.slice(1), providers: [provider] })).not.toBe(
      base().fingerprint,
    );
    expect(
      changed({
        capabilities: [...capabilities, { kind: "skill", name: "b", target: "claude" }],
        providers: [provider],
      }),
    ).not.toBe(base().fingerprint);
    expect(
      changed({
        capabilities: capabilities.map((c) => ({ ...c, target: "codex" })),
        providers: [provider],
      }),
    ).not.toBe(base().fingerprint);
    expect(changed({ capabilities, providers: [{ ...provider, skillUse: false }] })).not.toBe(
      base().fingerprint,
    );
  });

  it("includes the observation contract version", () => {
    expect(base().version).toBe(HARNESS_OBSERVATION_CONTRACT_VERSION);
  });

  it("hashes only identifiers: a path or secret cannot influence or appear in it", () => {
    const withPath = computeHarnessObservationBaseline({
      capabilities: [{ kind: "skill", name: "a", target: "claude" }],
      providers: [provider],
    });

    expect(JSON.stringify(withPath)).not.toMatch(/\/|Users|token/i);
    expect(Object.keys(withPath).sort()).toEqual(["fingerprint", "version"]);
  });

  it("derives installed capabilities from a manifest, per target", () => {
    const list = installedCapabilities({
      version: 1,
      entries: [
        {
          kind: "skill",
          path: ".agents/skills/a/SKILL.md",
          skill: "a",
          targets: ["codex", "kimi"],
          hash: "0".repeat(64),
        },
        {
          kind: "mcp",
          path: ".mcp.json",
          servers: ["playwright"],
          targets: ["claude"],
          hash: "0".repeat(64),
          created: true,
        },
      ],
    });

    expect(list).toEqual([
      { kind: "skill", name: "a", target: "codex" },
      { kind: "skill", name: "a", target: "kimi" },
      { kind: "mcp", name: "playwright", target: "claude" },
    ]);
  });

  it("rejects a baseline on anything but a session start", () => {
    const record = observation("claude", 1, { event: "session-end" });

    expect(parseObservationLine(JSON.stringify({ ...record, baseline: BASE }))).toBeUndefined();
    expect(
      parseObservationLine(JSON.stringify({ ...record, event: "session-start", baseline: BASE })),
    ).toBeDefined();
  });
});

describe("compaction keeps sessions whole", () => {
  it("retains each session's start (and baseline) with its capability records", () => {
    const list = [...sessions("claude", MAX_RETAINED_SESSIONS + 5, [0, 1, 2, 3, 4, 5, 6])];
    const compacted = compactObservations(list);
    const bySession = Map.groupBy(compacted, (o) => o.session);

    for (const records of bySession.values()) {
      expect(records.some((o) => o.event === "session-start" && o.baseline === BASE)).toBe(true);
    }
  });

  it("never leaves a partial session when the byte cap bites", () => {
    const list = sessions("claude", 20, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const compacted = compactObservations(list, { sessions: 50, bytes: 1500 });
    const bySession = Map.groupBy(compacted, (o) => o.session);

    expect(bySession.size).toBeGreaterThan(0);
    expect(bySession.size).toBeLessThan(20);

    for (const [session, records] of bySession) {
      const original = list.filter((o) => o.session === session).length;

      expect(records.some((o) => o.event === "session-start")).toBe(true);
      expect(records.length).toBe(original);
    }
  });

  it("merges identical session starts deterministically and keeps conflicting baselines apart", () => {
    const start = observation("claude", 1);
    const merged = compactObservations([start, start, { ...start, baseline: OTHER }]);

    expect(merged.find((o) => o.baseline === BASE)?.count).toBe(2);
    expect(merged.filter((o) => o.event === "session-start")).toHaveLength(2);
    expect(compactObservations([{ ...start, baseline: OTHER }, start, start])).toEqual(
      expect.arrayContaining(merged),
    );
  });
});

describe("store file", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agentyx-store-"));
    await mkdir(join(dir, ".git", "agentyx"), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("never reads or removes usage-v1.jsonl, and reports that it exists", async () => {
    const legacy = join(dir, ".git", "agentyx", "usage-v1.jsonl");
    const old = JSON.stringify({ ...observation("claude", 1), version: 1 });

    await writeFile(legacy, `${old}\n`, "utf8");

    const read = await readObservations(dir);

    expect(read).toMatchObject({ present: false, legacyData: true, observations: [] });
    expect(await readFile(legacy, "utf8")).toBe(`${old}\n`);
  });

  it("tells a store with no valid records from no store", async () => {
    await writeFile(join(dir, ".git", "agentyx", "usage-v2.jsonl"), "garbage\n", "utf8");

    expect(await readObservations(dir)).toMatchObject({ present: true, observations: [] });
  });
});
