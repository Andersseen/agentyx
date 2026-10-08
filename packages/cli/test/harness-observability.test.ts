import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDoctorReport, runDoctorCommand } from "../src/commands/doctor.js";
import { runHookObserveCommand } from "../src/commands/hook.js";
import { runInstallCommand } from "../src/commands/install.js";
import { createAgentyxProgram } from "../src/index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentyx-observe-"));
  await mkdir(join(dir, ".git"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await writeFile(join(dir, ".agentyx.json"), JSON.stringify(config), "utf8");
}

const installInput = {
  packs: [],
  enable: [],
  targets: [],
  skills: [],
  mcpServers: [],
  select: false,
  dryRun: false,
  json: false,
};

/** Writes the config and installs it, so hooks exist and sessions get a baseline. */
async function setup(config: Record<string, unknown>): Promise<void> {
  await writeConfig(config);
  await runInstallCommand({ ...installInput, cwd: dir });
}

async function observe(provider: string, payload: unknown): Promise<boolean> {
  return runHookObserveCommand({ provider, payload: JSON.stringify(payload), cwd: dir });
}

async function sessions(provider: string, count: number, usePlaywright: number): Promise<void> {
  for (let n = 0; n < count; n += 1) {
    const session_id = `${provider}-${n}`;

    await observe(provider, { session_id, hook_event_name: "SessionStart", source: "startup" });

    if (n < usePlaywright) {
      await observe(provider, {
        session_id,
        hook_event_name: "PostToolUse",
        tool_name: "mcp__playwright__browser_click",
        tool_input: {},
        tool_response: {},
      });
    }

    await observe(provider, { session_id, hook_event_name: "SessionEnd", reason: "other" });
  }
}

const usageFile = () => join(dir, ".git", "agentyx", "usage-v2.jsonl");

describe("agentyx hook observe", () => {
  it("is hidden from the primary help", () => {
    const program = createAgentyxProgram();

    expect(program.commands.map((command) => command.name())).toContain("hook");
    expect(program.helpInformation()).not.toMatch(/^\s+hook\b/m);
  });

  it("stores no prompt, tool payload, command or secret from a provider event", async () => {
    await observe("claude", {
      session_id: "raw-session-id-123",
      hook_event_name: "PostToolUse",
      tool_name: "mcp__playwright__browser_type",
      tool_input: { text: "my-password-hunter2", command: "curl -H 'Authorization: sk-live-abc'" },
      tool_response: { content: "TOP SECRET RESPONSE" },
      prompt: "please leak my AWS_SECRET_ACCESS_KEY",
      transcript_path: "/Users/me/.claude/projects/x.jsonl",
      cwd: "/Users/me/private",
      env: { TOKEN: "t0ken" },
    });

    const stored = await readFile(usageFile(), "utf8");
    const record = JSON.parse(stored);

    expect(Object.keys(record).sort()).toEqual([
      "capability",
      "capabilityKind",
      "event",
      "provider",
      "session",
      "timestamp",
      "version",
    ]);
    expect(record).toMatchObject({ provider: "claude", capability: "playwright" });
    for (const forbidden of [
      "raw-session-id",
      "hunter2",
      "sk-live",
      "SECRET",
      "AWS",
      "transcript",
      "/Users/me",
      "t0ken",
      "browser_type",
    ]) {
      expect(stored).not.toContain(forbidden);
    }
  });

  it("fails open: malformed, oversized, unknown-provider and non-Git input never throw", async () => {
    expect(await runHookObserveCommand({ provider: "claude", payload: "{nope", cwd: dir })).toBe(
      false,
    );
    expect(
      await runHookObserveCommand({ provider: "claude", payload: "x".repeat(300_000), cwd: dir }),
    ).toBe(false);
    expect(await observe("acme", { session_id: "a", hook_event_name: "SessionStart" })).toBe(false);
    expect(await observe("kimi", { session_id: "a", hook_event_name: "SessionStart" })).toBe(false);
    await rm(join(dir, ".git"), { recursive: true });
    expect(await observe("claude", { session_id: "a", hook_event_name: "SessionStart" })).toBe(
      false,
    );
  });

  it("keeps the state bounded across many sessions", async () => {
    for (let n = 0; n < 80; n += 1) {
      await observe("codex", { session_id: `s${n}`, hook_event_name: "SessionEnd" });
    }

    const lines = (await readFile(usageFile(), "utf8")).trim().split("\n");

    expect(lines.length).toBeLessThanOrEqual(50);
  });

  it("records quickly in-process (the cost is Node start-up, not the observer)", async () => {
    const started = performance.now();

    for (let n = 0; n < 40; n += 1) {
      await observe("claude", { session_id: "perf", hook_event_name: "SessionStart" });
    }

    expect((performance.now() - started) / 40).toBeLessThan(50);
  });
});

describe("doctor harness observability", () => {
  it("A: shows a static footprint with no observations and no cleanup advice", async () => {
    await setup({ packs: ["typescript", "efficiency"], targets: ["claude"] });

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.harness.footprint.packs.configured).toBe(2);
    expect(report.harness.footprint.mcp).toEqual({ active: 0, declared: 1 });
    expect(report.observation.sessions).toBe(0);
    expect(report.utilization.packs.every((pack) => pack.observedSessionRate === null)).toBe(true);
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(renderDoctorReport(report, false)).toContain("no sessions in the current harness yet");
  });

  it("B: suggests cleanup for a high-context MCP never used over 10 sessions", async () => {
    await setup({ packs: ["testing", "efficiency"], enable: ["playwright"], targets: ["claude"] });
    await sessions("claude", 10, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });
    const text = renderDoctorReport(report, false);

    expect(report.harness.footprint.contextSurface.high).toBe(1);
    expect(report.diagnostics).toContainEqual({
      level: "info",
      code: "dormant_mcp_candidate",
      message: expect.stringContaining('"playwright" is active, high-context'),
    });
    expect(report.status).not.toBe("errors");
    expect(text).toContain("Potential cleanup");
    expect(text).toContain(
      "playwright: high context cost, 0 observed calls / 10 current-harness observable sessions",
    );
  });

  it("does not suggest cleanup after only a few sessions", async () => {
    await setup({ packs: ["testing", "efficiency"], enable: ["playwright"], targets: ["claude"] });
    await sessions("claude", 3, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(report.utilization.capabilities.find((c) => c.name === "playwright")?.state).toBe(
      "insufficient-sample",
    );
  });

  it("C: shows the observed session rate with numerator/denominator and no cleanup", async () => {
    await setup({ packs: ["testing", "efficiency"], enable: ["playwright"], targets: ["claude"] });
    await sessions("claude", 10, 6);

    const report = await runDoctorCommand({ json: false, cwd: dir });
    const mcp = report.utilization.capabilities.find((c) => c.name === "playwright");

    expect(mcp).toMatchObject({
      observedSessions: 6,
      eligibleSessions: 10,
      observedSessionRate: 0.6,
    });
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(renderDoctorReport(report, false)).toContain("6 / 10 observable sessions with calls");
    expect(report.observation.semantics).toMatch(/not a token, cost or context-window share/);
  });

  it("D: counts a shared chrome-devtools MCP once", async () => {
    await writeConfig({
      packs: ["performance", "accessibility"],
      enable: ["chrome-devtools"],
      targets: ["claude"],
    });

    const report = await runDoctorCommand({ json: true, cwd: dir });
    const devtools = report.utilization.capabilities.filter((c) => c.name === "chrome-devtools");

    expect(report.harness.footprint.mcp.active).toBe(1);
    expect(report.harness.footprint.contextSurface.high).toBe(1);
    expect(devtools).toHaveLength(1);
    expect(devtools[0]?.packs).toEqual(["performance", "accessibility"]);
  });

  it("E: reports Codex, Claude and Kimi capabilities, with Kimi static-only", async () => {
    await writeConfig({ packs: ["efficiency"], targets: ["codex", "claude", "kimi"] });
    await sessions("claude", 2, 0);
    await sessions("codex", 1, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });
    const byId = Object.fromEntries(report.observation.providers.map((p) => [p.id, p]));

    expect(byId.claude).toMatchObject({
      visibility: "strong",
      sessions: 2,
      currentBaselineSessions: 0, // nothing installed, so no session has a baseline
      coverage: "unavailable",
      runtimeObservation: "available",
    });
    expect(byId.codex).toMatchObject({ visibility: "partial", sessions: 1 });
    expect(byId.codex?.hooks).toMatchObject({ trust: "review-may-be-required", configured: false });
    expect(byId.kimi).toMatchObject({
      visibility: "unavailable",
      runtimeObservation: "unavailable",
    });

    const text = renderDoctorReport(report, false);

    expect(text).toContain("Kimi Code: static only — runtime usage observation unavailable");
    expect(text).toContain("user review may be required");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: "runtime_observation_unavailable" }),
    );
  });

  it("reports provider-reported context tokens without inventing a percentage", async () => {
    await setup({ packs: ["efficiency"], targets: ["claude"] });
    await observe("claude", {
      session_id: "c",
      hook_event_name: "SessionStart",
      source: "resume",
      context_tokens: 182000,
    });

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]?.lastReportedContextTokens).toBe(182000);
    expect(renderDoctorReport(report, false)).toContain(
      "last provider-reported context: 182k tokens",
    );
  });

  it("I: marks pack evidence strong, partial and unavailable", async () => {
    await setup({
      packs: ["testing", "efficiency", "security"],
      enable: ["playwright"],
      targets: ["codex"],
    });
    await sessions("codex", 4, 1);

    const report = await runDoctorCommand({ json: true, cwd: dir });
    const evidence = Object.fromEntries(report.utilization.packs.map((p) => [p.name, p.evidence]));

    expect(evidence.security).toBe("unavailable"); // Codex cannot show Skill use
    expect(evidence.efficiency).toBe("unavailable");
    expect(evidence.testing).toBe("partial");
    expect(
      report.utilization.packs.find((p) => p.name === "testing")?.observedSessionRate,
    ).toBeNull();
    expect(renderDoctorReport(report, false)).toContain("security: usage unavailable");
  });

  it("notes pack breadth informationally, without saying packs are wrong", async () => {
    await writeConfig({
      packs: ["technical", "security", "documentation", "refactoring", "agentic"],
      targets: ["claude"],
    });

    const report = await runDoctorCommand({ json: false, cwd: dir });
    const note = report.diagnostics.find((d) => d.code === "pack_breadth");

    expect(note?.level).toBe("info");
    expect(note?.message).toContain("may be intentional workflow choices");
  });

  it("keeps a healthy session-start hook output empty", async () => {
    await writeFile(join(dir, "package.json"), "{}", "utf8");
    await writeConfig({ packs: ["technical"], targets: ["claude"] });
    await runInstallCommand({
      packs: [],
      enable: [],
      targets: [],
      skills: [],
      mcpServers: [],
      select: false,
      dryRun: false,
      json: false,
      cwd: dir,
    });

    const report = await runDoctorCommand({ json: false, cwd: dir });
    const { renderDoctorHookOutput } = await import("../src/commands/doctor.js");

    expect(report.status).toBe("healthy");
    expect(renderDoctorHookOutput(report)).toBe("");
  });
});

describe("install with the efficiency pack", () => {
  const input = {
    packs: [],
    enable: [],
    skills: [],
    mcpServers: [],
    select: false,
    dryRun: false,
    json: false,
  };

  it("Kimi: writes no hooks, no user-level config and no plugin", async () => {
    await writeConfig({ packs: ["efficiency"], targets: ["kimi"] });
    await runInstallCommand({ ...input, targets: [], cwd: dir });

    const manifest = JSON.parse(await readFile(join(dir, ".agentyx.lock.json"), "utf8"));

    expect(manifest.entries.some((entry: { kind: string }) => entry.kind === "hook")).toBe(false);
    expect(await readdir(dir)).not.toContain(".codex");
    expect(await readdir(join(dir, ".kimi-code")).catch(() => [])).not.toContain("config.toml");
  });

  it("Codex + Claude: installs project-local hooks tracked by the manifest, then removes them", async () => {
    await writeConfig({ packs: ["efficiency"], targets: ["codex", "claude"] });
    await runInstallCommand({ ...input, targets: [], cwd: dir });

    const manifest = JSON.parse(await readFile(join(dir, ".agentyx.lock.json"), "utf8"));
    const hookPaths = manifest.entries
      .filter((entry: { kind: string }) => entry.kind === "hook")
      .map((entry: { path: string }) => entry.path)
      .sort();

    expect(hookPaths).toEqual([".claude/settings.json", ".codex/hooks.json"]);

    const codexHooks = JSON.parse(await readFile(join(dir, ".codex", "hooks.json"), "utf8"));

    expect(Object.keys(codexHooks.hooks).sort()).toEqual([
      "PostToolUse",
      "SessionEnd",
      "SessionStart",
    ]);
    expect(JSON.stringify(codexHooks)).toContain("--provider codex");

    const { runUninstallCommand } = await import("../src/commands/uninstall.js");

    await runUninstallCommand({
      targets: [],
      dryRun: false,
      json: false,
      force: false,
      cwd: dir,
    } as never);
    await expect(readFile(join(dir, ".codex", "hooks.json"), "utf8")).rejects.toThrow();
  });
});

const SESSION_START = "SessionStart";

async function observeSessions(
  provider: string,
  count: number,
  usePlaywright: number,
  prefix = "x",
): Promise<void> {
  for (let n = 0; n < count; n += 1) {
    const session_id = `${prefix}-${provider}-${n}`;

    await observe(provider, { session_id, hook_event_name: SESSION_START });

    if (n < usePlaywright) {
      await observe(provider, {
        session_id,
        hook_event_name: "PostToolUse",
        tool_name: "mcp__playwright__browser_click",
      });
    }
  }
}

const playwrightOf = (report: Awaited<ReturnType<typeof runDoctorCommand>>) =>
  report.utilization.capabilities.find((c) => c.name === "playwright");
const harness = { packs: ["testing", "efficiency"], enable: ["playwright"], targets: ["claude"] };

describe("configuration-aware baselines", () => {
  it("stamps a session start with the installed baseline and nothing else new", async () => {
    await setup(harness);
    await observe("claude", { session_id: "s", hook_event_name: SESSION_START });
    await observe("claude", {
      session_id: "s",
      hook_event_name: "PostToolUse",
      tool_name: "mcp__playwright__x",
    });

    const [start, tool] = (await readFile(usageFile(), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(start.baseline).toBe(report.observation.currentBaseline.fingerprint);
    expect(start.baseline).toMatch(/^[0-9a-f]{16}$/);
    expect(tool.baseline).toBeUndefined();
    // Baseline data is an opaque id: no path, no project name, no capability text.
    expect(JSON.stringify(start)).not.toContain(dir);
    expect(JSON.stringify(start)).not.toMatch(/playwright|claude\/|\.json/);
  });

  it("records no baseline when nothing is installed, and never counts that session", async () => {
    await writeConfig(harness);
    await observeSessions("claude", 12, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.currentBaseline.fingerprint).toBeNull();
    expect(report.observation.unbaselinedSessions).toBe(12);
    expect(playwrightOf(report)?.state).not.toBe("dormant-candidate");
  });

  it("smoke: pending install, harness change and reinstall each start from the right sample", async () => {
    await setup(harness);
    await observeSessions("claude", 12, 0, "one");

    let report = await runDoctorCommand({ json: false, cwd: dir });
    const first = report.observation.currentBaseline.fingerprint;

    expect(playwrightOf(report)).toMatchObject({
      state: "dormant-candidate",
      eligibleSessions: 12,
    });
    expect(report.observation).toMatchObject({ sessions: 12, historicalSessions: 0 });

    // The config changes but nothing is reinstalled: old sessions say nothing about it.
    await writeConfig({ ...harness, packs: ["testing", "efficiency", "security"] });
    report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.negativeEvidence).toBe("paused-pending-install");
    expect(report.observation.currentBaseline.fingerprint).toBe(first);
    expect(playwrightOf(report)).toMatchObject({
      state: "paused-pending-install",
      eligibleSessions: 0,
    });
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(renderDoctorReport(report, false)).toContain("utilization paused");

    // A session starting now still belongs to the installed baseline, not the desired one.
    await observeSessions("claude", 1, 0, "pending");
    expect(
      (await runDoctorCommand({ json: false, cwd: dir })).observation.currentBaseline.sessions,
    ).toBe(13);

    // Reinstall: a new baseline begins and the old sessions are history.
    await runInstallCommand({ ...installInput, cwd: dir });
    report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.currentBaseline.fingerprint).not.toBe(first);
    expect(report.observation).toMatchObject({
      sessions: 13,
      historicalSessions: 13,
      negativeEvidence: "enabled",
    });
    expect(report.observation.currentBaseline.sessions).toBe(0);
    expect(playwrightOf(report)).toMatchObject({ state: "no-data", eligibleSessions: 0 });
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: "info", code: "observation_baseline_reset" }),
    );
    expect(renderDoctorReport(report, false)).toContain("historical sessions ignored: 13");

    // Enough new sessions: a valid, current-only result.
    await observeSessions("claude", 10, 4, "two");
    report = await runDoctorCommand({ json: false, cwd: dir });

    expect(playwrightOf(report)).toMatchObject({
      state: "observed",
      observedSessions: 4,
      eligibleSessions: 10,
      observedSessionRate: 0.4,
    });
    expect(report.observation.historicalSessions).toBe(13);
    expect(report.diagnostics.some((d) => d.code === "observation_baseline_reset")).toBe(false);
  });

  it("keeps old sessions of a newly enabled capability out of its denominator", async () => {
    await setup({ packs: ["efficiency"], targets: ["claude"] });
    await observeSessions("claude", 20, 0, "old");
    await writeConfig(harness);
    await runInstallCommand({ ...installInput, cwd: dir });
    await observeSessions("claude", 1, 0, "new");

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(playwrightOf(report)).toMatchObject({
      state: "insufficient-sample",
      eligibleSessions: 1,
    });
  });

  it("ignores a legacy usage-v1.jsonl without touching it", async () => {
    await setup(harness);
    await mkdir(join(dir, ".git", "agentyx"), { recursive: true });
    await writeFile(join(dir, ".git", "agentyx", "usage-v1.jsonl"), "legacy\n", "utf8");

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.store).toMatchObject({ file: "usage-v2.jsonl", legacyData: true });
    expect(report.observation.sessions).toBe(0);
    expect(renderDoctorReport(report, false)).toContain("legacy usage-v1.jsonl");
    expect(await readFile(join(dir, ".git", "agentyx", "usage-v1.jsonl"), "utf8")).toBe("legacy\n");
  });

  it("hides context sizes from a previous harness", async () => {
    await setup({ packs: ["efficiency"], targets: ["claude"] });
    await observe("claude", {
      session_id: "a",
      hook_event_name: SESSION_START,
      context_tokens: 90000,
    });
    await writeConfig({
      packs: ["efficiency", "testing"],
      enable: ["playwright"],
      targets: ["claude"],
    });
    await runInstallCommand({ ...installInput, cwd: dir });

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]?.lastReportedContextTokens).toBeUndefined();
    expect(renderDoctorReport(report, false)).not.toContain("last provider-reported context");
  });
});

describe("provider coverage and baselines", () => {
  it("Codex: partial until a hook has run, then its current sessions count", async () => {
    await setup({ packs: ["efficiency", "testing"], enable: ["playwright"], targets: ["codex"] });

    let report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]).toMatchObject({
      coverage: "partial",
      hooks: { configured: true, trust: "review-may-be-required" },
      currentBaselineSessions: 0,
    });

    await observeSessions("codex", 10, 0);
    report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]).toMatchObject({
      coverage: "active",
      visibility: "partial",
      sessions: 10,
      currentBaselineSessions: 10,
    });
    expect(playwrightOf(report)).toMatchObject({
      state: "dormant-candidate",
      eligibleSessions: 10,
    });
  });

  it("Codex with inline hooks: the observer is skipped, so old sessions are no negative evidence", async () => {
    await mkdir(join(dir, ".codex"));
    await writeFile(
      join(dir, ".codex", "config.toml"),
      '[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "ding"\n',
    );
    await setup({ packs: ["efficiency", "testing"], enable: ["playwright"], targets: ["codex"] });
    await observeSessions("codex", 15, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]).toMatchObject({ coverage: "unavailable" });
    expect(playwrightOf(report)?.state).toBe("unobservable");
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
  });

  it("Claude with its hooks removed: earlier sessions stop being negative evidence", async () => {
    await setup(harness);
    await observeSessions("claude", 12, 0);
    await rm(join(dir, ".claude", "settings.json"));

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.observation.providers[0]?.coverage).toBe("unavailable");
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
  });

  it("Claude + Codex + Kimi: per-provider current counts; Kimi never adds runtime evidence", async () => {
    await setup({
      packs: ["efficiency", "testing"],
      enable: ["playwright"],
      targets: ["claude", "codex", "kimi"],
    });
    await observeSessions("claude", 6, 0);
    await observeSessions("codex", 4, 0);
    await observeSessions("kimi", 5, 0); // Kimi has no observer; the payloads are rejected

    const report = await runDoctorCommand({ json: true, cwd: dir });
    const byId = Object.fromEntries(report.observation.providers.map((p) => [p.id, p]));

    expect(byId.claude).toMatchObject({ coverage: "active", currentBaselineSessions: 6 });
    expect(byId.codex).toMatchObject({ currentBaselineSessions: 4 });
    expect(byId.kimi).toMatchObject({
      coverage: "unavailable",
      runtimeObservation: "unavailable",
      sessions: 0,
    });
    expect(report.observation.currentBaseline.sessions).toBe(10);
    expect(playwrightOf(report)?.eligibleSessions).toBe(10);
  });
});
