import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDoctorCommand,
  renderDoctorReport,
  runDoctorCommand,
} from "../src/commands/doctor.js";
import { createAgentyxProgram } from "../src/index.js";

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
    await writeConfig({ extends: ["typescript"], profile: "balanced", targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("healthy");
    expect(report.project).toMatchObject({
      packageManager: "pnpm",
      detectedStacks: ["typescript"],
      recommendedStack: "typescript",
      config: { present: true, valid: true },
    });
    expect(report.resolution).toMatchObject({
      resolvedStacks: ["core", "typescript"],
      skillsCount: 4,
      declaredMcpCount: 0,
      activeMcpCount: 0,
      skippedMcpCount: 0,
    });
    expect(report.installation.summary).toEqual({ create: 4, update: 0, unchanged: 0 });
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
    await writeConfig({ extends: ["typescript"], targets: ["opencode"] });

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
    expect(report.diagnostics).toContainEqual({
      level: "error",
      code: "unknown_target",
      message: 'Configured target "opencode" has no adapter.',
    });
  });

  it("warns when Angular is detected but only TypeScript is configured", async () => {
    await cp(join(fixturesPath, "angular-project"), projectDir, { recursive: true });
    await writeConfig({ extends: ["typescript"], profile: "balanced", targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("warnings");
    expect(report.diagnostics).toContainEqual({
      level: "warning",
      code: "detected_angular_configured_typescript",
      message: "Angular detected but project config uses only `typescript`.",
    });
  });

  it("reports lean profile MCP filtering as info", async () => {
    await writeConfig({ extends: ["angular"], profile: "lean", targets: ["codex"] });

    const report = await runDoctorCommand({ json: false, cwd: projectDir });

    expect(report.status).toBe("warnings");
    expect(report.diagnostics).toContainEqual({
      level: "info",
      code: "mcp_filtered_by_profile",
      message: "lean profile skips recommended MCP server context7.",
    });
    expect(report.resolution).toMatchObject({
      declaredMcpCount: 1,
      activeMcpCount: 0,
      skippedMcpCount: 1,
    });
  });

  it("renders stable JSON output", async () => {
    await writeConfig({ extends: ["core"], profile: "balanced", targets: ["claude"] });

    const report = await runDoctorCommand({ json: true, cwd: projectDir });
    const output = renderDoctorReport(report, true);

    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      status: "warnings",
      configuration: {
        stacks: ["core"],
        profile: "balanced",
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
    await writeConfig({ extends: ["core"], targets: ["codex", "kimi"] });

    await runDoctorCommand({ json: false, cwd: projectDir });

    expect(await readdir(projectDir)).toEqual([".agentyx.json"]);
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
