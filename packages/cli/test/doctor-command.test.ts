import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDoctorCommand,
  renderDoctorReport,
  runDoctorCommand,
} from "../src/commands/doctor.js";
import { runInstallCommand } from "../src/commands/install.js";
import { createAgentyxProgram } from "../src/index.js";

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

const fixturesPath = fileURLToPath(
  new URL("../../../packages/core/test/fixtures", import.meta.url),
);

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-doctor-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await writeFile(
    join(projectDir, ".agentyx.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

describe("agentyx doctor", () => {
  it("reports a healthy project", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("healthy");
    expect(report.project).toMatchObject({
      packageManager: "pnpm",
      detectedPacks: ["typescript"],
      recommendedPacks: ["technical", "typescript"],
      config: { present: true, valid: true },
    });
    expect(report.resolution).toMatchObject({
      resolvedPacks: ["technical", "typescript"],
      skillsCount: 7,
    });
    expect(report.installation.summary).toEqual({
      create: 7,
      update: 0,
      unchanged: 0,
      conflict: 0,
      delete: 0,
    });
    expect(await readdir(projectDir)).not.toContain(".agents");
  });

  it("warns when config is missing", async () => {
    await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("warnings");
    expect(report.diagnostics).toContainEqual({
      level: "warning",
      code: "agentyx_config_missing",
      message: ".agentyx.json is missing. Run agentyx init to create it.",
    });
  });

  it("reports malformed config as an error", async () => {
    await writeFile(join(projectDir, ".agentyx.json"), "{", "utf8");

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("errors");
    expect(
      report.diagnostics.some((diagnostic) => diagnostic.code === "agentyx_config_parse_error"),
    ).toBe(true);
  });

  it("reports unknown targets as errors", async () => {
    await writeConfig({ packs: ["typescript"], targets: ["opencode"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("errors");
    expect(report.targets).toContainEqual({
      id: "opencode",
      known: false,
      name: undefined,
      skillsPath: undefined,
      skillsPathExists: undefined,
      mcpPath: undefined,
      mcpPathExists: undefined,
    });
  });

  it("warns when Angular is detected but only TypeScript is configured", async () => {
    await cp(join(fixturesPath, "angular-project"), projectDir, { recursive: true });
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("warnings");
    expect(report.diagnostics).toContainEqual({
      level: "warning",
      code: "detected_angular_configured_typescript",
      message: "Angular detected but project config uses only `typescript`.",
    });
  });

  it("reports optional efficiency capabilities", async () => {
    await writeConfig({
      packs: ["efficiency"],
      enable: ["codebase-memory"],
      targets: ["codex"],
    });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.resolution.mcp).toEqual([
      { name: "codebase-memory", activation: "optional", active: true },
    ]);
    expect(report.resolution.tools[0]).toMatchObject({
      name: "rtk",
      activation: "optional",
      active: false,
    });
    expect(report.efficiency.codebaseMemory).toBe("enabled");
  });

  it("renders stable JSON output", async () => {
    await writeConfig({ packs: ["technical"], targets: ["claude"] });

    const report = await runDoctorCommand({ json: true, cwd: projectDir });
    const output = renderDoctorReport(report, true);

    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      status: "warnings",
      configuration: {
        packs: ["technical"],
        enable: [],
        targets: ["claude"],
      },
    });
    expect(parsed.targets).toContainEqual({
      id: "claude",
      known: true,
      name: "Claude Code",
      skillsPath: ".claude/skills",
      skillsPathExists: false,
      mcpPath: ".mcp.json",
      mcpPathExists: false,
    });
  });

  it("does not write during installability checks", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex", "kimi"] });

    await runDoctorCommand({ json: false, cwd: projectDir });

    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);
  });
});

describe("agentyx doctor install manifest", () => {
  it("reports no managed files before the first install", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.installation.manifest).toEqual({
      present: false,
      entries: 0,
      stale: [],
      drifted: [],
      conflicts: [],
    });
  });

  it("counts what an installation recorded, and stays healthy", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.installation.manifest.present).toBe(true);
    expect(report.installation.manifest.entries).toBe(7);
    expect(report.status).toBe("healthy");
  });

  it("warns about installed skills the configuration no longer resolves", async () => {
    await writeConfig({ packs: ["technical", "typescript"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });
    await writeConfig({ packs: ["technical"], targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.installation.manifest.stale).toContain(
      ".agents/skills/typescript-strict/SKILL.md",
    );
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "stale_managed_files",
    );
    expect(report.status).toBe("warnings");
  });

  it("warns about a managed skill edited since installation", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await runInstallCommand({ ...installInput, cwd: projectDir });
    await writeFile(
      join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"),
      "edited\n",
      "utf8",
    );

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.installation.manifest.drifted).toEqual([".agents/skills/code-quality/SKILL.md"]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "drifted_managed_file",
    );
  });

  it("errors on a destination Agentyx does not manage", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await mkdir(join(projectDir, ".agents", "skills", "code-quality"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "code-quality", "SKILL.md"),
      "mine\n",
      "utf8",
    );

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.installation.manifest.conflicts).toEqual([
      ".agents/skills/code-quality/SKILL.md",
    ]);
    expect(report.status).toBe("errors");
    expect(renderDoctorReport(report, false)).toContain("not managed by Agentyx");
  });

  it("reports a damaged manifest instead of crashing", async () => {
    await writeConfig({ packs: ["technical"], targets: ["codex"] });
    await writeFile(join(projectDir, ".agentyx.lock.json"), "{ not json", "utf8");

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("errors");
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "agentyx_manifest_parse_error",
    );
  });
});

describe("doctor command wiring", () => {
  it("is part of the top-level program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("doctor");
  });

  it("has only stable output options", () => {
    expect(createDoctorCommand().options.map((option) => option.long)).toEqual(["--json"]);
  });
});
