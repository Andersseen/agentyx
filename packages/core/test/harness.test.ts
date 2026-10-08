import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  builtInMcpServerRegistry,
  builtInPackRegistry,
  compactObservations,
  computeHarnessFootprint,
  computeUtilization,
  DORMANCY_MIN_SESSIONS,
  deriveCapabilityProvenance,
  type HarnessObservation,
  hashSessionKey,
  MAX_RETAINED_SESSIONS,
  OBSERVATION_VERSION,
  parseObservationLine,
  readObservations,
  recordObservation,
  resolvePacks,
  resolveUsageFile,
} from "../src/index.js";

const claude = { id: "claude", skills: true, mcp: true };
const codex = { id: "codex", skills: false, mcp: true };
const kimi = { id: "kimi", skills: false, mcp: false };

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
    ...extra,
  };
}

function sessions(provider: string, count: number, mcpFor: readonly number[] = []) {
  return Array.from({ length: count }, (_, n) => [
    observation(provider, n),
    ...(mcpFor.includes(n)
      ? [
          observation(provider, n, {
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

function utilization(observations: readonly HarnessObservation[], targets = ["claude"]) {
  return computeUtilization({
    observations,
    providers: [claude, codex, kimi],
    targets,
    capabilities: [
      playwright,
      { kind: "skill", name: "angular-modern", packs: ["angular"], activation: "default" },
      { kind: "tool", name: "rtk", packs: ["efficiency"], activation: "optional" },
    ],
    resolvedPacks: ["angular", "testing", "efficiency"],
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
      join(dir, ".git", "agentyx", "usage-v1.jsonl"),
    );
  });

  it("follows a .git file (linked worktree) instead of assuming a directory", async () => {
    const real = join(dir, "main", ".git", "worktrees", "wt");
    const worktree = join(dir, "wt");

    await mkdir(real, { recursive: true });
    await mkdir(worktree);
    await writeFile(join(worktree, ".git"), `gitdir: ${real}\n`, "utf8");

    expect(await resolveUsageFile(worktree)).toBe(join(real, "agentyx", "usage-v1.jsonl"));
  });

  it("has no location outside a Git checkout, and never falls back to $HOME", async () => {
    expect(await resolveUsageFile(dir)).toBeUndefined();
    expect(await recordObservation(dir, observation("claude", 1))).toBe(false);
  });

  it("round-trips observations and tolerates garbage lines", async () => {
    await mkdir(join(dir, ".git"));
    await recordObservation(dir, observation("claude", 1));
    await recordObservation(dir, observation("claude", 2, { event: "session-end" }));

    const file = join(dir, ".git", "agentyx", "usage-v1.jsonl");

    await writeFile(file, `${await readFile(file, "utf8")}garbage\n`, "utf8");

    const { observations } = await readObservations(dir);

    expect(observations).toHaveLength(2);
    expect((await stat(file)).size).toBeLessThan(2048);
  });
});
