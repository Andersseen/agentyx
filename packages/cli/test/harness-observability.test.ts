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

const usageFile = () => join(dir, ".git", "agentyx", "usage-v1.jsonl");

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
    await writeConfig({ packs: ["technical", "typescript"], targets: ["claude"] });

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.harness.footprint.packs.configured).toBe(2);
    expect(report.harness.footprint.mcp).toEqual({ active: 0, declared: 0 });
    expect(report.observation.sessions).toBe(0);
    expect(report.utilization.packs.every((pack) => pack.observedSessionRate === null)).toBe(true);
    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(renderDoctorReport(report, false)).toContain("no sessions recorded yet");
  });

  it("B: suggests cleanup for a high-context MCP never used over 10 sessions", async () => {
    await writeConfig({ packs: ["testing"], enable: ["playwright"], targets: ["claude"] });
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
      "playwright: high context cost, 0 observed calls / 10 observable sessions",
    );
  });

  it("does not suggest cleanup after only a few sessions", async () => {
    await writeConfig({ packs: ["testing"], enable: ["playwright"], targets: ["claude"] });
    await sessions("claude", 3, 0);

    const report = await runDoctorCommand({ json: false, cwd: dir });

    expect(report.diagnostics.some((d) => d.code === "dormant_mcp_candidate")).toBe(false);
    expect(report.utilization.capabilities.find((c) => c.name === "playwright")?.state).toBe(
      "insufficient-sample",
    );
  });

  it("C: shows the observed session rate with numerator/denominator and no cleanup", async () => {
    await writeConfig({ packs: ["testing"], enable: ["playwright"], targets: ["claude"] });
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
    await writeConfig({ packs: ["efficiency"], targets: ["claude"] });
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
    await writeConfig({
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
