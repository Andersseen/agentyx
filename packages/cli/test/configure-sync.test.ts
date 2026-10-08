import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runConfigureCommand } from "../src/commands/configure.js";
import { runDoctorCommand } from "../src/commands/doctor.js";
import { runSyncCommand } from "../src/commands/sync.js";

const prompts = vi.hoisted(() => ({
  multiselect: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  multiselect: prompts.multiselect,
  confirm: prompts.confirm,
  isCancel: (value: unknown) => typeof value === "symbol" && value.description === "cancel",
}));

let projectDir: string;

async function setup(config: unknown): Promise<void> {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-lifecycle-"));
  await writeFile(
    join(projectDir, ".agentyx.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

afterEach(async () => {
  if (projectDir !== undefined) await rm(projectDir, { recursive: true, force: true });
  prompts.multiselect.mockReset();
  prompts.confirm.mockReset();
});

describe("agentyx configure", () => {
  it("does not create config when missing and points to init", async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-lifecycle-"));
    await expect(
      runConfigureCommand({ cwd: projectDir, dryRun: false, json: false, yes: true, sync: false }),
    ).rejects.toThrow(/agentyx init/);
  });

  it("previews changes and preserves unrelated desired config without writing", async () => {
    await setup({
      packs: ["technical"],
      targets: ["codex"],
      skillDirectories: ["skills"],
      localPacks: [{ name: "local", skills: ["my-skill"] }],
      project: { id: "demo", name: "Demo" },
      context: { constraints: ["Keep APIs stable"] },
    });
    await mkdir(join(projectDir, "skills"), { recursive: true });
    await mkdir(join(projectDir, "src"), { recursive: true });
    const before = await readFile(join(projectDir, ".agentyx.json"), "utf8");
    const output = await runConfigureCommand({
      cwd: projectDir,
      dryRun: true,
      json: false,
      yes: true,
      sync: false,
      addPacks: ["testing"],
    });
    expect(output).toContain("+ testing");
    expect(await readFile(join(projectDir, ".agentyx.json"), "utf8")).toBe(before);
    expect(await readdir(projectDir)).not.toContain(".agentyx.lock.json");
    expect(await readdir(projectDir)).not.toContain(".agents");
  });

  it("applies explicit changes, reports orphaned capabilities, and preserves project fields", async () => {
    await setup({
      packs: ["testing", "technical"],
      enable: ["playwright"],
      targets: ["codex"],
      project: { id: "demo", name: "Demo" },
    });
    const result = JSON.parse(
      await runConfigureCommand({
        cwd: projectDir,
        dryRun: false,
        json: true,
        yes: true,
        sync: false,
        removePacks: ["testing"],
      }),
    );
    const saved = JSON.parse(await readFile(join(projectDir, ".agentyx.json"), "utf8"));
    expect(saved.packs).toEqual(["technical"]);
    expect(saved.enable).toEqual([]);
    expect(saved.project).toEqual({ id: "demo", name: "Demo" });
    expect(result.changes.capabilities.orphaned).toEqual(["playwright"]);
    expect(result.written).toBe(true);
  });

  it("emits machine-readable dry-run output without touching provider or manifest state", async () => {
    await setup({ packs: ["technical"], targets: ["codex"] });
    const report = JSON.parse(
      await runConfigureCommand({
        cwd: projectDir,
        dryRun: true,
        json: true,
        yes: true,
        sync: false,
        addTargets: ["claude"],
      }),
    );
    expect(report.changed).toBe(true);
    expect(report.config.after.targets).toEqual(["codex", "claude"]);
    expect(report.written).toBe(false);
    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);
  });

  it("starts interactive options from current selections, shows recommendations and confirms once", async () => {
    await setup({ packs: ["testing"], enable: ["playwright"], targets: ["codex"] });
    await writeFile(
      join(projectDir, "package.json"),
      JSON.stringify({ dependencies: { "@angular/core": "^20.0.0" } }),
    );
    prompts.multiselect
      .mockResolvedValueOnce(["technical"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["codex"]);
    prompts.confirm.mockResolvedValueOnce(true);

    await runConfigureCommand({
      cwd: projectDir,
      dryRun: false,
      json: false,
      yes: false,
      sync: false,
      interactive: true,
    });

    expect(prompts.multiselect.mock.calls[0]?.[0]).toMatchObject({ initialValues: ["testing"] });
    const packsPrompt = prompts.multiselect.mock.calls[0]?.[0] as {
      options: Array<{ value: string; hint?: string }>;
    };
    expect(packsPrompt.options.find((option) => option.value === "angular")?.hint).toContain(
      "recommended",
    );
    expect(prompts.multiselect.mock.calls[1]?.[0]).toMatchObject({ initialValues: [] });
    expect(prompts.confirm).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the interactive confirmation is cancelled", async () => {
    await setup({ packs: ["testing"], enable: ["playwright"], targets: ["codex"] });
    const before = await readFile(join(projectDir, ".agentyx.json"), "utf8");
    prompts.multiselect
      .mockResolvedValueOnce(["technical"])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["codex"]);
    prompts.confirm.mockResolvedValueOnce(false);

    await expect(
      runConfigureCommand({
        cwd: projectDir,
        dryRun: false,
        json: false,
        yes: false,
        sync: false,
        interactive: true,
      }),
    ).rejects.toThrow(/No files were written/);
    expect(await readFile(join(projectDir, ".agentyx.json"), "utf8")).toBe(before);
  });
});

describe("agentyx sync", () => {
  it("converges from config, prunes owned files, and is idempotent", async () => {
    await setup({ packs: ["testing"], targets: ["codex", "claude", "kimi"] });
    const preview = JSON.parse(
      await runSyncCommand({ cwd: projectDir, dryRun: true, json: true, force: false }),
    );
    expect(preview.dryRun).toBe(true);
    expect(preview.summary.create).toBeGreaterThan(0);
    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);

    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    expect(await readdir(join(projectDir, ".agents", "skills"))).toContain("test-strategy");
    const second = JSON.parse(
      await runSyncCommand({ cwd: projectDir, dryRun: false, json: true, force: false }),
    );
    expect(second.summary.create).toBe(0);
    expect(second.summary.update).toBe(0);
    expect(second.summary.delete).toBe(0);

    await writeFile(
      join(projectDir, ".agentyx.json"),
      '{"packs":[],"targets":["codex","claude","kimi"]}\n',
      "utf8",
    );
    const prunePreview = JSON.parse(
      await runSyncCommand({ cwd: projectDir, dryRun: true, json: true, force: false }),
    );
    expect(prunePreview.summary.delete).toBeGreaterThan(0);
    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    await expect(readdir(join(projectDir, ".agents"))).rejects.toThrow();
  });

  it("prunes removed targets and still preserves skills shared with selected targets", async () => {
    await setup({ packs: ["technical"], targets: ["codex", "kimi", "claude"] });
    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    await writeFile(
      join(projectDir, ".agentyx.json"),
      '{"packs":["technical"],"targets":["codex"]}\n',
      "utf8",
    );

    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });

    expect(await readdir(join(projectDir, ".agents", "skills"))).toContain("code-quality");
    await expect(readdir(join(projectDir, ".claude"))).rejects.toThrow();
    const manifest = JSON.parse(await readFile(join(projectDir, ".agentyx.lock.json"), "utf8"));
    expect(
      manifest.entries.find((entry: { skill?: string }) => entry.skill === "code-quality")?.targets,
    ).toEqual(["codex"]);
  });

  it("syncs to an empty target selection by pruning previously managed provider state", async () => {
    await setup({ packs: ["technical"], targets: ["codex"] });
    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    await writeFile(join(projectDir, ".agentyx.json"), '{"packs":[],"targets":[]}\n', "utf8");

    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });

    await expect(readdir(join(projectDir, ".agents"))).rejects.toThrow();
    await expect(readFile(join(projectDir, ".agentyx.lock.json"), "utf8")).rejects.toThrow();
  });

  it("keeps Doctor evidence paused after configure until sync converges the installed baseline", async () => {
    await setup({ packs: ["testing"], enable: ["playwright"], targets: ["codex", "claude"] });
    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    await runConfigureCommand({
      cwd: projectDir,
      dryRun: false,
      json: true,
      yes: true,
      sync: false,
      disable: ["playwright"],
    });

    const pending = await runDoctorCommand({ cwd: projectDir, json: false });
    expect(pending.diagnostics.some((item) => item.code === "installation_pending")).toBe(true);
    expect(pending.utilization.negativeEvidence).toBe("paused-pending-install");

    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    const converged = await runDoctorCommand({ cwd: projectDir, json: false });
    expect(converged.diagnostics.some((item) => item.code === "installation_pending")).toBe(false);
  });

  it("merges and prunes only Agentyx MCP entries through configure --sync", async () => {
    await setup({ packs: ["testing"], enable: ["playwright"], targets: ["claude"] });
    await writeFile(
      join(projectDir, ".mcp.json"),
      JSON.stringify({ custom: true, mcpServers: { handWritten: { command: "local-tool" } } }),
    );
    await runSyncCommand({ cwd: projectDir, dryRun: false, json: false, force: false });
    const installed = JSON.parse(await readFile(join(projectDir, ".mcp.json"), "utf8"));
    expect(installed.mcpServers).toHaveProperty("handWritten");
    expect(installed.mcpServers).toHaveProperty("playwright");

    await runConfigureCommand({
      cwd: projectDir,
      dryRun: false,
      json: false,
      yes: true,
      sync: true,
      disable: ["playwright"],
    });
    const pruned = JSON.parse(await readFile(join(projectDir, ".mcp.json"), "utf8"));
    expect(pruned).toMatchObject({
      custom: true,
      mcpServers: { handWritten: { command: "local-tool" } },
    });
    expect(pruned.mcpServers).not.toHaveProperty("playwright");
  });

  it("keeps the new desired config when configure --sync is blocked by an unmanaged file", async () => {
    await setup({ packs: ["testing"], enable: ["playwright"], targets: ["codex"] });
    const userSkill = join(projectDir, ".agents", "skills", "test-strategy", "SKILL.md");
    await mkdir(join(projectDir, ".agents", "skills", "test-strategy"), { recursive: true });
    await writeFile(userSkill, "hand-written skill\n", "utf8");

    await expect(
      runConfigureCommand({
        cwd: projectDir,
        dryRun: false,
        json: false,
        yes: true,
        sync: true,
        disable: ["playwright"],
      }),
    ).rejects.toThrow(
      /configuration updated\. sync blocked[\s\S]*resolve the conflict and run agentyx sync/i,
    );
    const saved = JSON.parse(await readFile(join(projectDir, ".agentyx.json"), "utf8"));
    expect(saved.enable).toEqual([]);
    expect(await readFile(userSkill, "utf8")).toBe("hand-written skill\n");
  });
});
