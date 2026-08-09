import { access } from "node:fs/promises";
import { relative, sep } from "node:path";
import {
  builtInAdapterRegistry,
  type InstallPlan,
  planInstall,
  summarizeInstallPlans,
} from "@agentyx/adapters";
import {
  type AgentyxConfig,
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  detectProject,
  getOptimizationProfile,
  loadAgentyxConfig,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { Command } from "commander";
import { section, toJson } from "../output.js";

export type DoctorLevel = "info" | "warning" | "error";
export type DoctorStatus = "healthy" | "warnings" | "errors";

export interface DoctorDiagnostic {
  readonly level: DoctorLevel;
  readonly code: string;
  readonly message: string;
}

export interface DoctorReport {
  readonly status: DoctorStatus;
  readonly project: {
    readonly packageManager: string | undefined;
    readonly packageManagerAmbiguous: boolean;
    readonly packageManagerLockfiles: readonly string[];
    readonly detectedStacks: readonly string[];
    readonly recommendedStack: string | undefined;
    readonly config: {
      readonly path: string;
      readonly present: boolean;
      readonly valid: boolean;
    };
  };
  readonly configuration: {
    readonly stacks: readonly string[];
    readonly profile: string | undefined;
    readonly targets: readonly string[];
  };
  readonly resolution: {
    readonly resolvedStacks: readonly string[];
    readonly skillsCount: number;
    readonly declaredMcpCount: number;
    readonly activeMcpCount: number;
    readonly skippedMcpCount: number;
  };
  readonly targets: readonly {
    readonly id: string;
    readonly known: boolean;
    readonly name: string | undefined;
    readonly skillsPath: string | undefined;
    readonly skillsPathExists: boolean | undefined;
    readonly mcpPath: string | undefined;
    readonly mcpPathExists: boolean | undefined;
  }[];
  readonly installation: {
    readonly summary:
      | { readonly create: number; readonly update: number; readonly unchanged: number }
      | undefined;
  };
  readonly optimization: {
    readonly profile: string | undefined;
    readonly notes: readonly string[];
    readonly filteredMcp: readonly { readonly name: string; readonly level: string }[];
  };
  readonly diagnostics: readonly DoctorDiagnostic[];
}

export interface DoctorCommandInput {
  readonly json: boolean;
  readonly cwd: string;
}

export async function runDoctorCommand(input: DoctorCommandInput): Promise<DoctorReport> {
  const diagnostics: DoctorDiagnostic[] = [];
  const project = await detectProject(input.cwd);
  const configState = await readConfig(input.cwd);
  const targetReports: Array<DoctorReport["targets"][number]> = [];
  let resolved: ReturnType<typeof resolveAgentyxConfig> | undefined;
  let plans: readonly InstallPlan[] | undefined;

  if (project.packageManager.ambiguous) {
    diagnostics.push({
      level: "warning",
      code: "ambiguous_package_manager",
      message: `Multiple package-manager lockfiles found: ${project.packageManager.lockfiles.join(", ")}.`,
    });
  }

  if (!project.packageJson.present) {
    diagnostics.push({
      level: "warning",
      code: "package_json_missing",
      message: "package.json was not found; project detection is limited.",
    });
  } else if (!project.packageJson.valid) {
    diagnostics.push({
      level: "warning",
      code: "package_json_invalid",
      message: `package.json could not be parsed: ${project.packageJson.error ?? "unknown error"}.`,
    });
  }

  if (configState.error !== undefined) {
    diagnostics.push(configState.error);
  }

  if (configState.config !== undefined) {
    try {
      resolved = resolveAgentyxConfig(configState.config);
    } catch (cause) {
      diagnostics.push({
        level: "error",
        code: "resolution_failed",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  if (
    project.recommendedStack === "angular" &&
    resolved !== undefined &&
    resolved.requestedStacks.includes("typescript") &&
    !resolved.requestedStacks.includes("angular")
  ) {
    diagnostics.push({
      level: "warning",
      code: "detected_angular_configured_typescript",
      message: "Angular detected but project config uses only `typescript`.",
    });
  }

  const configuredTargets = resolved?.targets ?? configState.config?.targets ?? [];
  const unknownTargets = configuredTargets.filter((target) => !builtInAdapterRegistry.has(target));

  for (const target of unknownTargets) {
    diagnostics.push({
      level: "error",
      code: "unknown_target",
      message: `Configured target "${target}" has no adapter.`,
    });
  }

  const reportTargets = [...new Set([...builtInAdapterRegistry.ids, ...configuredTargets])];

  for (const target of reportTargets) {
    if (!builtInAdapterRegistry.has(target)) {
      targetReports.push({
        id: target,
        known: false,
        name: undefined,
        skillsPath: undefined,
        skillsPathExists: undefined,
        mcpPath: undefined,
        mcpPathExists: undefined,
      });
      continue;
    }

    const adapter = builtInAdapterRegistry.get(target);
    const detection = await adapter.detect(input.cwd);
    const mcpPath = adapter.mcpConfigPath?.(input.cwd);

    targetReports.push({
      id: target,
      known: true,
      name: adapter.name,
      skillsPath: displayPath(input.cwd, detection.skillsPath),
      skillsPathExists: detection.present,
      mcpPath: mcpPath === undefined ? undefined : displayPath(input.cwd, mcpPath),
      mcpPathExists: mcpPath === undefined ? undefined : await fileExists(mcpPath),
    });
  }

  if (resolved !== undefined && unknownTargets.length === 0 && resolved.targets.length > 0) {
    plans = await planInstall({
      targets: resolved.targets,
      projectDir: input.cwd,
      skills: resolved.skills.map((name) => builtInSkillRegistry.get(name)),
      mcpServers: resolved.mcpServers.map((name) => builtInMcpServerRegistry.get(name)),
    });
  }

  const filteredMcp =
    resolved?.declaredMcpServers.filter((server) => !resolved?.mcpServers.includes(server.name)) ??
    [];

  for (const server of filteredMcp) {
    diagnostics.push({
      level: "info",
      code: "mcp_filtered_by_profile",
      message: `${resolved?.profile ?? "profile"} profile skips ${server.level} MCP server ${server.name}.`,
    });
  }

  return {
    status: statusOf(diagnostics),
    project: {
      packageManager: project.packageManager.name,
      packageManagerAmbiguous: project.packageManager.ambiguous,
      packageManagerLockfiles: project.packageManager.lockfiles,
      detectedStacks: project.detectedStacks,
      recommendedStack: project.recommendedStack,
      config: {
        path: ".agentyx.json",
        present: configState.present,
        valid: configState.valid,
      },
    },
    configuration: {
      stacks: configState.config?.extends ?? [],
      profile: configState.config?.profile,
      targets: configState.config?.targets ?? [],
    },
    resolution: {
      resolvedStacks: resolved?.resolvedStacks ?? [],
      skillsCount: resolved?.skills.length ?? 0,
      declaredMcpCount: resolved?.declaredMcpServers.length ?? 0,
      activeMcpCount: resolved?.mcpServers.length ?? 0,
      skippedMcpCount: filteredMcp.length,
    },
    targets: targetReports,
    installation: {
      summary: plans === undefined ? undefined : summarizeInstallPlans(plans),
    },
    optimization: {
      profile: resolved?.profile,
      notes: resolved === undefined ? [] : getOptimizationProfile(resolved.profile).notes,
      filteredMcp,
    },
    diagnostics,
  };
}

export function renderDoctorReport(report: DoctorReport, json: boolean): string {
  if (json) {
    return toJson(report);
  }

  return [
    `Agentyx doctor: ${report.status}`,
    "",
    section("Project", [
      `package manager: ${report.project.packageManager ?? "unknown"}${
        report.project.packageManagerAmbiguous ? " (ambiguous)" : ""
      }`,
      `detected stacks: ${report.project.detectedStacks.join(", ") || "none"}`,
      `recommended stack: ${report.project.recommendedStack ?? "none"}`,
      `.agentyx.json: ${report.project.config.present ? (report.project.config.valid ? "valid" : "invalid") : "missing"}`,
    ]),
    section("Configuration", [
      `stacks: ${report.configuration.stacks.join(", ") || "none"}`,
      `profile: ${report.configuration.profile ?? "none"}`,
      `targets: ${report.configuration.targets.join(", ") || "none"}`,
    ]),
    section("Resolution", [
      `resolved stacks: ${report.resolution.resolvedStacks.join(", ") || "none"}`,
      `skills: ${report.resolution.skillsCount}`,
      `MCP declared/active/skipped: ${report.resolution.declaredMcpCount}/${report.resolution.activeMcpCount}/${report.resolution.skippedMcpCount}`,
    ]),
    section(
      "Targets",
      report.targets.map(
        (target) =>
          `${target.id}: ${
            target.known
              ? `${target.name} skills=${target.skillsPath} (${target.skillsPathExists ? "present" : "not present"}) MCP=${target.mcpPath ?? "not supported"}${
                  target.mcpPath === undefined
                    ? ""
                    : ` (${target.mcpPathExists ? "present" : "not present"})`
                }`
              : "unknown"
          }`,
      ),
    ),
    section(
      "Installation",
      report.installation.summary === undefined
        ? ["not planned"]
        : [
            `${report.installation.summary.create} to create, ${report.installation.summary.update} to update, ${report.installation.summary.unchanged} unchanged`,
          ],
    ),
    section("Optimization", [
      `profile: ${report.optimization.profile ?? "none"}`,
      `filtered MCP: ${
        report.optimization.filteredMcp
          .map((server) => `${server.name} (${server.level})`)
          .join(", ") || "none"
      }`,
    ]),
    section(
      "Diagnostics",
      report.diagnostics.map(
        (diagnostic) => `${diagnostic.level.toUpperCase()}: ${diagnostic.message}`,
      ),
    ),
  ].join("\n");
}

async function readConfig(projectDir: string): Promise<{
  readonly present: boolean;
  readonly valid: boolean;
  readonly config: AgentyxConfig | undefined;
  readonly error: DoctorDiagnostic | undefined;
}> {
  try {
    return {
      present: true,
      valid: true,
      config: await loadAgentyxConfig(projectDir),
      error: undefined,
    };
  } catch (cause) {
    if (cause instanceof AgentyxConfigNotFoundError) {
      return {
        present: false,
        valid: false,
        config: undefined,
        error: {
          level: "warning",
          code: "agentyx_config_missing",
          message: ".agentyx.json is missing. Run agentyx init to create it.",
        },
      };
    }

    if (cause instanceof AgentyxConfigParseError || cause instanceof AgentyxConfigValidationError) {
      return {
        present: true,
        valid: false,
        config: undefined,
        error: {
          level: "error",
          code: cause.code,
          message: cause.message,
        },
      };
    }

    throw cause;
  }
}

function statusOf(diagnostics: readonly DoctorDiagnostic[]): DoctorStatus {
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    return "errors";
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === "warning")) {
    return "warnings";
  }

  return "healthy";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw cause;
  }
}

function displayPath(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Inspect Agentyx configuration, resolution, targets and installability.")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (options: { json: boolean }) => {
      const report = await runDoctorCommand({ json: options.json, cwd: process.cwd() });

      process.stdout.write(`${renderDoctorReport(report, options.json)}\n`);

      if (report.status === "errors") {
        process.exitCode = 1;
      }
    });
}
