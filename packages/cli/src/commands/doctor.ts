import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, relative, sep } from "node:path";
import {
  builtInAdapterRegistry,
  collectInstallConflicts,
  type InstallPlan,
  planInstall,
  summarizeInstallPlans,
} from "@agentyx/adapters";
import {
  type AgentyxConfig,
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
  AgentyxManifestParseError,
  AgentyxManifestValidationError,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  builtInToolRegistry,
  detectProject,
  emptyInstallManifest,
  type InstallManifest,
  loadAgentyxConfig,
  loadInstallManifest,
  manifestEntriesByPath,
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
    readonly detectedPacks: readonly string[];
    readonly recommendedPacks: readonly string[];
    readonly config: {
      readonly path: string;
      readonly present: boolean;
      readonly valid: boolean;
    };
  };
  readonly configuration: {
    readonly packs: readonly string[];
    readonly enable: readonly string[];
    readonly targets: readonly string[];
  };
  readonly resolution: {
    readonly resolvedPacks: readonly string[];
    readonly skillsCount: number;
    readonly mcp: readonly {
      readonly name: string;
      readonly activation: string;
      readonly active: boolean;
    }[];
    readonly tools: readonly {
      readonly name: string;
      readonly activation: string;
      readonly active: boolean;
      readonly available: boolean;
    }[];
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
      | {
          readonly create: number;
          readonly update: number;
          readonly unchanged: number;
          readonly conflict: number;
          readonly delete: number;
        }
      | undefined;
    /** What `.agentyx.lock.json` says about the files Agentyx manages here. */
    readonly manifest: {
      readonly present: boolean;
      readonly entries: number;
      /** Managed files the current selection no longer resolves. */
      readonly stale: readonly string[];
      /** Managed files that have been edited since Agentyx wrote them. */
      readonly drifted: readonly string[];
      /** Destinations Agentyx would need but does not manage. */
      readonly conflicts: readonly string[];
    };
  };
  readonly efficiency: {
    readonly conciseOutput: boolean;
    readonly targetedExploration: boolean;
    readonly rtk: "available" | "not installed" | "not selected";
    readonly codebaseMemory: "enabled" | "disabled" | "not selected";
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
  const manifestState = await readManifest(input.cwd);
  const manifest = manifestState.manifest;
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

  if (manifestState.error !== undefined) {
    diagnostics.push(manifestState.error);
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
    project.detectedPacks.includes("angular") &&
    resolved?.requestedPacks.includes("typescript") === true &&
    !resolved.requestedPacks.includes("angular")
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
      manifest,
      prune: true,
    });
  }

  const recorded = manifestEntriesByPath(manifest);
  const stale =
    plans
      ?.flatMap((plan) => plan.deletions)
      .filter((operation) => operation.status === "delete")
      .map((operation) => operation.relativePath) ?? [];
  const allConflicts = plans === undefined ? [] : collectInstallConflicts(plans);
  const drifted = allConflicts.filter((path) => recorded.has(path));
  const conflicts = allConflicts.filter((path) => !recorded.has(path));

  if (stale.length > 0) {
    diagnostics.push({
      level: "warning",
      code: "stale_managed_files",
      message: `${stale.length} installed file(s) are no longer resolved by this configuration: ${stale.join(", ")}. Run agentyx install --prune to remove them.`,
    });
  }

  for (const path of drifted) {
    diagnostics.push({
      level: "warning",
      code: "drifted_managed_file",
      message: `${path} has been edited since Agentyx wrote it. Agentyx will not replace or remove it.`,
    });
  }

  for (const path of conflicts) {
    diagnostics.push({
      level: "error",
      code: "unmanaged_file_conflict",
      message: `${path} is needed by this configuration but Agentyx did not write it. Move it, or install with --force.`,
    });
  }

  const toolReports =
    resolved === undefined
      ? []
      : await Promise.all(
          resolved.declaredTools.map(async (tool) => ({
            name: tool.name,
            activation: tool.activation,
            active: resolved.tools.includes(tool.name),
            available: await executableAvailable(builtInToolRegistry.get(tool.name).command),
          })),
        );
  const mcpReports =
    resolved?.declaredMcpServers.map((server) => ({
      name: server.name,
      activation: server.activation,
      active: resolved?.mcpServers.includes(server.name) ?? false,
    })) ?? [];

  return {
    status: statusOf(diagnostics),
    project: {
      packageManager: project.packageManager.name,
      packageManagerAmbiguous: project.packageManager.ambiguous,
      packageManagerLockfiles: project.packageManager.lockfiles,
      detectedPacks: project.detectedPacks,
      recommendedPacks: project.recommendedPacks,
      config: {
        path: ".agentyx.json",
        present: configState.present,
        valid: configState.valid,
      },
    },
    configuration: {
      packs: configState.config?.packs ?? [],
      enable: configState.config?.enable ?? [],
      targets: configState.config?.targets ?? [],
    },
    resolution: {
      resolvedPacks: resolved?.resolvedPacks ?? [],
      skillsCount: resolved?.skills.length ?? 0,
      mcp: mcpReports,
      tools: toolReports,
    },
    targets: targetReports,
    installation: {
      summary: plans === undefined ? undefined : summarizeInstallPlans(plans),
      manifest: {
        present: manifestState.present,
        entries: manifest.entries.length,
        stale,
        drifted,
        conflicts,
      },
    },
    efficiency: {
      conciseOutput: resolved?.skills.includes("concise-output") ?? false,
      targetedExploration: resolved?.skills.includes("targeted-exploration") ?? false,
      rtk:
        toolReports.find((tool) => tool.name === "rtk")?.available === true
          ? "available"
          : resolved?.declaredTools.some((tool) => tool.name === "rtk") === true
            ? "not installed"
            : "not selected",
      codebaseMemory:
        resolved?.mcpServers.includes("codebase-memory") === true
          ? "enabled"
          : resolved?.declaredMcpServers.some((server) => server.name === "codebase-memory") ===
              true
            ? "disabled"
            : "not selected",
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
      `detected packs: ${report.project.detectedPacks.join(", ") || "none"}`,
      `recommended packs: ${report.project.recommendedPacks.join(", ") || "none"}`,
      `.agentyx.json: ${report.project.config.present ? (report.project.config.valid ? "valid" : "invalid") : "missing"}`,
    ]),
    section("Configuration", [
      `packs: ${report.configuration.packs.join(", ") || "none"}`,
      `enable: ${report.configuration.enable.join(", ") || "none"}`,
      `targets: ${report.configuration.targets.join(", ") || "none"}`,
    ]),
    section("Resolution", [
      `resolved packs: ${report.resolution.resolvedPacks.join(", ") || "none"}`,
      `skills: ${report.resolution.skillsCount}`,
      `MCP: ${
        report.resolution.mcp
          .map((server) => `${server.name} (${server.active ? "active" : "disabled"})`)
          .join(", ") || "none"
      }`,
      `tools: ${
        report.resolution.tools
          .map(
            (tool) =>
              `${tool.name} (${tool.active ? "active" : "disabled"}, ${
                tool.available ? "available" : "not installed"
              })`,
          )
          .join(", ") || "none"
      }`,
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
    section("Installation", [
      report.installation.summary === undefined
        ? "not planned"
        : `${report.installation.summary.create} to create, ${report.installation.summary.update} to update, ${report.installation.summary.unchanged} unchanged`,
      `manifest: ${
        report.installation.manifest.present
          ? `${report.installation.manifest.entries} managed file(s)`
          : "none recorded"
      }`,
      `stale: ${report.installation.manifest.stale.join(", ") || "none"}`,
      `edited since install: ${report.installation.manifest.drifted.join(", ") || "none"}`,
      `not managed by Agentyx: ${report.installation.manifest.conflicts.join(", ") || "none"}`,
    ]),
    section("Efficiency", [
      `concise output: ${report.efficiency.conciseOutput ? "enabled" : "disabled"}`,
      `targeted exploration: ${report.efficiency.targetedExploration ? "enabled" : "disabled"}`,
      `RTK: ${report.efficiency.rtk}`,
      `Codebase Memory: ${report.efficiency.codebaseMemory}`,
    ]),
    section(
      "Diagnostics",
      report.diagnostics.map(
        (diagnostic) => `${diagnostic.level.toUpperCase()}: ${diagnostic.message}`,
      ),
    ),
  ].join("\n");
}

export function doctorExitCode(report: DoctorReport, check: boolean): number | undefined {
  if (report.status === "errors" || (check && report.status === "warnings")) {
    return 1;
  }

  return undefined;
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

/**
 * Reads the install manifest without letting a damaged one stop the report.
 *
 * Every other command refuses to act on a manifest it cannot understand, which
 * is right — they write. Doctor exists to explain what is wrong, so a broken
 * manifest becomes a diagnostic and the rest of the report still gets produced.
 */
async function readManifest(projectDir: string): Promise<{
  readonly present: boolean;
  readonly manifest: InstallManifest;
  readonly error: DoctorDiagnostic | undefined;
}> {
  try {
    const manifest = await loadInstallManifest(projectDir);

    return { present: manifest.entries.length > 0, manifest, error: undefined };
  } catch (cause) {
    if (
      cause instanceof AgentyxManifestParseError ||
      cause instanceof AgentyxManifestValidationError
    ) {
      return {
        present: true,
        manifest: emptyInstallManifest(),
        error: { level: "error", code: cause.code, message: cause.message },
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

async function executableAvailable(command: string): Promise<boolean> {
  if (command.includes("/")) {
    return fileExecutable(command);
  }

  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }

    if (await fileExecutable(`${directory}/${command}`)) {
      return true;
    }
  }

  return false;
}

async function fileExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function displayPath(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Inspect Agentyx configuration, resolution, targets and installability.")
    .option("--json", "print machine-readable JSON only", false)
    .option("--check", "exit with code 1 on warnings as well as errors", false)
    .action(async (options: { json: boolean; check: boolean }) => {
      const report = await runDoctorCommand({ json: options.json, cwd: process.cwd() });

      process.stdout.write(`${renderDoctorReport(report, options.json)}\n`);

      process.exitCode = doctorExitCode(report, options.check);
    });
}
