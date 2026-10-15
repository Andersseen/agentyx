import { access } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  builtInAdapterRegistry,
  collectInstallConflicts,
  type InstallPlan,
  ProviderConfigParseError,
  planInstall,
  summarizeInstallPlans,
  UnsupportedMcpEnvReferenceError,
  UnsupportedMcpTransportError,
} from "@agentyx/adapters";
import {
  type AgentyxConfig,
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
  AgentyxError,
  AgentyxManifestParseError,
  AgentyxManifestValidationError,
  type AgentyxProject,
  builtInAgentRegistry,
  builtInHookRegistry,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  builtInToolRegistry,
  compareResolutionSnapshots,
  detectProject,
  emptyInstallManifest,
  type InstallManifest,
  isExecutableOnPath,
  loadAgentyxProject,
  loadInstallManifest,
  loadInstallManifestState,
  type McpServerDefinition,
  manifestEntriesByPath,
  type Recommendation,
  type ResolutionDifference,
  type ResolutionSnapshot,
  recommendCapabilities,
  resolveAgentyxConfig,
  type UtilizationReport,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";
import { createCurrentProjectResolutionSnapshot, describeDifference } from "../snapshot.js";
import {
  buildHarnessReports,
  type HarnessSection,
  type ObservationSection,
} from "./doctor-harness.js";

export type DoctorLevel = "info" | "warning" | "error";
export type DoctorStatus = "healthy" | "warnings" | "errors";
export type ReadinessState = "ready" | "not-ready" | "unknown";

export interface DoctorReadiness {
  readonly configuration: { readonly state: ReadinessState };
  readonly installation: { readonly state: ReadinessState };
  readonly localPrerequisites: { readonly state: ReadinessState };
}

export interface DoctorDiagnostic {
  readonly level: DoctorLevel;
  readonly code: string;
  readonly message: string;
  readonly capability?: { readonly kind: "mcp" | "tool"; readonly name: string };
  readonly target?: string;
  readonly requirement?: {
    readonly kind: "command" | "environment" | "transport" | "scope";
    readonly name?: string;
  };
}

export type ReproducibilityState =
  | "not-checked"
  | "matching"
  | "mismatch"
  | "missing-lock"
  | "legacy-lock"
  | "snapshot-unavailable"
  | "unavailable";

/** The `--locked` comparison of current inputs with the lock's resolution snapshot. */
export interface DoctorReproducibility {
  readonly checked: boolean;
  readonly state: ReproducibilityState;
  /** Safe categories only: no hashes, bodies or configuration. */
  readonly differences: readonly ResolutionDifference[];
}

export interface DoctorReport {
  readonly status: DoctorStatus;
  readonly reproducibility: DoctorReproducibility;
  readonly readiness: DoctorReadiness;
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
    readonly hooks: readonly {
      readonly name: string;
      readonly activation: string;
      readonly active: boolean;
    }[];
    readonly agents: readonly {
      readonly name: string;
      readonly activation: string;
      readonly active: boolean;
      readonly targets: readonly {
        readonly target: string;
        readonly supported: boolean;
        readonly state: string;
      }[];
    }[];
  };
  /**
   * Advisory only: packs `recommendCapabilities` suggests but the configuration does not select.
   * Surfaced as `info` diagnostics, never `warning` or `error` — not selecting a suggestion is not
   * a health problem.
   */
  readonly recommendations: {
    readonly missingPacks: readonly Recommendation[];
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
  /** Configured footprint and context surface, from configuration and registries alone. */
  readonly harness: HarnessSection;
  /** What local provider hooks have recorded; empty when nothing has been recorded yet. */
  readonly observation: ObservationSection;
  /** Observed-session rates per pack and capability, with their numerators and denominators. */
  readonly utilization: UtilizationReport;
  readonly diagnostics: readonly DoctorDiagnostic[];
}

export interface DoctorCommandInput {
  readonly json: boolean;
  readonly cwd: string;
  /** Compare current harness inputs with the complete lock snapshot. Read-only. */
  readonly locked?: boolean;
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
  let planningUnknown = false;

  if (project.packageManager.ambiguous) {
    diagnostics.push({
      level: "warning",
      code: "ambiguous_package_manager",
      message: `Multiple package-manager lockfiles found: ${project.packageManager.lockfiles.join(", ")}.`,
    });
  }

  if (!project.packageJson.present && !project.signals.rust.detected) {
    diagnostics.push({
      level: "warning",
      code: "package_json_missing",
      message: "package.json was not found; project detection is limited.",
    });
  } else if (project.packageJson.present && !project.packageJson.valid) {
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
      resolved = resolveAgentyxConfig(
        configState.config,
        configState.project?.packRegistry,
        configState.project?.skillRegistry,
      );
    } catch (cause) {
      diagnostics.push({
        level: "error",
        code: "resolution_failed",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  const recommendation = recommendCapabilities(project.signals, {
    configuredPacks: configState.config?.packs,
  });
  const recommendedPacks = recommendation.packs.map((pack) => pack.name);
  const detectedPacks = recommendedPacks.filter((name) => name !== "technical");
  const missingPacks =
    resolved === undefined
      ? []
      : recommendation.packs.filter((pack) => !resolved.resolvedPacks.includes(pack.name));

  if (
    detectedPacks.includes("angular") &&
    resolved?.requestedPacks.includes("typescript") === true &&
    !resolved.requestedPacks.includes("angular")
  ) {
    diagnostics.push({
      level: "warning",
      code: "detected_angular_configured_typescript",
      message: "Angular detected but project config uses only `typescript`.",
    });
  }

  for (const pack of missingPacks) {
    diagnostics.push({
      level: "info",
      code: "recommended_pack_available",
      message: `Pack "${pack.name}" is recommended but not configured: ${pack.reasons.join(" ")}`,
    });
  }

  if (resolved !== undefined && resolved.hooks.length > 0) {
    const hookRuntimeAvailable = await projectLocalBinaryAvailable(input.cwd, "agentyx");

    if (!hookRuntimeAvailable) {
      diagnostics.push({
        level: "warning",
        code: "hook_runtime_unavailable",
        message:
          "Agentyx hooks run `npx --no-install agentyx ...`, which needs @agentyx/cli installed as " +
          "a project dependency (for example `pnpm add -D @agentyx/cli`) so npx can resolve " +
          "node_modules/.bin/agentyx. Running Agentyx only through `pnpm dlx @agentyx/cli` does " +
          "not install it, so the hooks will not run.",
      });
    }
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

  const activeMcpServers =
    resolved?.mcpServers.map((name) => builtInMcpServerRegistry.get(name)) ?? [];

  if (resolved !== undefined && unknownTargets.length === 0) {
    for (const target of resolved.targets) {
      const adapter = builtInAdapterRegistry.get(target);

      if (!adapter.capabilities.mcp.project && activeMcpServers.length > 0) {
        for (const server of activeMcpServers) {
          diagnostics.push(mcpUnsupportedDiagnostic(target, server, "scope"));
        }
      }

      for (const server of activeMcpServers) {
        if (
          adapter.capabilities.mcp.transports !== undefined &&
          !adapter.capabilities.mcp.transports.includes(server.transport)
        ) {
          diagnostics.push(mcpUnsupportedDiagnostic(target, server, "transport"));
        }
      }
    }
  }

  if (
    resolved !== undefined &&
    unknownTargets.length === 0 &&
    resolved.targets.length > 0 &&
    !diagnostics.some((diagnostic) => diagnostic.code === "mcp_unsupported")
  ) {
    try {
      plans = await planInstall({
        targets: resolved.targets,
        projectDir: input.cwd,
        skills: resolved.skills.map((name) =>
          (configState.project?.skillRegistry ?? builtInSkillRegistry).get(name),
        ),
        mcpServers: activeMcpServers,
        hooks: resolved.hooks.map((name) => builtInHookRegistry.get(name)),
        agents: resolved.agents.map((name) => builtInAgentRegistry.get(name)),
        manifest,
        prune: true,
      });
    } catch (cause) {
      planningUnknown = true;
      const diagnostic = planningDiagnostic(cause);

      if (diagnostic !== undefined) {
        diagnostics.push(diagnostic);
      } else {
        throw cause;
      }
    }
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
      message: `${stale.length} installed file(s) are no longer resolved by this configuration: ${stale.join(", ")}. Run agentyx sync to remove them.`,
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
            available: await isExecutableOnPath(builtInToolRegistry.get(tool.name).command),
          })),
        );
  const mcpReports =
    resolved?.declaredMcpServers.map((server) => ({
      name: server.name,
      activation: server.activation,
      active: resolved?.mcpServers.includes(server.name) ?? false,
    })) ?? [];

  let localPrerequisitesUnavailable = false;

  for (const serverName of resolved?.mcpServers ?? []) {
    const server = builtInMcpServerRegistry.get(serverName);
    const references = server.transport === "stdio" ? server.env : server.headers;

    if (server.transport === "stdio") {
      const commandAvailable = await isExecutableOnPath(server.command, { cwd: input.cwd });

      if (!commandAvailable) {
        localPrerequisitesUnavailable = true;
        diagnostics.push({
          level: "warning",
          code: "mcp_command_missing",
          message: `MCP server "${server.name}" is active but command "${server.command}" was not found on PATH.`,
          capability: { kind: "mcp", name: server.name },
          requirement: { kind: "command", name: server.command },
        });
      }
    }

    for (const reference of Object.values(references)) {
      if (process.env[reference.fromEnv] !== undefined && process.env[reference.fromEnv] !== "") {
        continue;
      }

      localPrerequisitesUnavailable = true;
      diagnostics.push({
        level: "warning",
        code: "mcp_environment_missing",
        message: `MCP server "${server.name}" requires environment variable "${reference.fromEnv}", which is not set.`,
        capability: { kind: "mcp", name: server.name },
        requirement: { kind: "environment", name: reference.fromEnv },
      });
    }
  }
  const hookReports =
    resolved?.declaredHooks.map((hook) => ({
      name: hook.name,
      activation: hook.activation,
      active: resolved?.hooks.includes(hook.name) ?? false,
    })) ?? [];
  const agentReports =
    resolved?.declaredAgents.map((agent) => ({
      name: agent.name,
      activation: agent.activation,
      active: resolved.agents.includes(agent.name),
      targets: configuredTargets.map((target) => {
        const adapter = builtInAdapterRegistry.has(target)
          ? builtInAdapterRegistry.get(target)
          : undefined;
        const op = plans
          ?.find((plan) => plan.target === target)
          ?.agentOperations.find((item) => item.agent === agent.name);
        const state =
          op?.status === "unchanged"
            ? "installed"
            : op?.status === "conflict"
              ? "conflict"
              : op?.status === "create" || op?.status === "update"
                ? "pending"
                : "pending";
        return {
          target,
          supported: adapter?.capabilities.agents ?? false,
          state:
            adapter === undefined || !adapter.capabilities.agents
              ? "unsupported"
              : !resolved.agents.includes(agent.name)
                ? "disabled"
                : state,
        };
      }),
    })) ?? [];
  const summary = plans === undefined ? undefined : summarizeInstallPlans(plans);

  if (resolved !== undefined && unknownTargets.length === 0 && resolved.targets.length === 0) {
    diagnostics.push({
      level: "warning",
      code: "no_targets_configured",
      message: "No targets are configured. Add a target to .agentyx.json, or pass --target.",
    });
  }

  if (summary !== undefined && summary.create + summary.update + summary.delete > 0) {
    diagnostics.push({
      level: "warning",
      code: "installation_pending",
      message: `${summary.create} file(s) to create, ${summary.update} to update and ${summary.delete} to remove are not yet installed. Run agentyx sync to apply them.`,
    });
  }

  for (const tool of toolReports) {
    if (!tool.active || tool.available) {
      continue;
    }

    const installHint = builtInToolRegistry.get(tool.name).installHint;

    diagnostics.push({
      level: "warning",
      code: "required_tool_missing",
      message: [
        `Tool "${tool.name}" is selected but its executable was not found on PATH.`,
        installHint,
      ]
        .filter((part) => part !== undefined)
        .join(" "),
    });
    localPrerequisitesUnavailable = true;
  }

  const hookUnavailable = diagnostics.some(
    (diagnostic) => diagnostic.code === "hook_runtime_unavailable",
  );
  localPrerequisitesUnavailable ||= hookUnavailable;
  const configurationReady =
    configState.valid &&
    resolved !== undefined &&
    unknownTargets.length === 0 &&
    configuredTargets.length > 0 &&
    !diagnostics.some((diagnostic) =>
      ["resolution_failed", "unknown_target", "no_targets_configured", "mcp_unsupported"].includes(
        diagnostic.code,
      ),
    );
  const installationState: ReadinessState =
    !configurationReady || planningUnknown || plans === undefined
      ? "unknown"
      : summary === undefined ||
          summary.create + summary.update + summary.delete + summary.conflict > 0 ||
          stale.length > 0 ||
          drifted.length > 0 ||
          conflicts.length > 0
        ? "not-ready"
        : "ready";

  const reproducibility: DoctorReproducibility =
    input.locked === true
      ? await checkLockedResolution({
          cwd: input.cwd,
          configProject: configState.project,
          resolved,
          diagnostics,
        })
      : { checked: false, state: "not-checked", differences: [] };

  const harnessReports = await buildHarnessReports({
    cwd: input.cwd,
    resolved,
    configuredPacks: configState.config?.packs ?? [],
    recommendedPacks,
    targets: configuredTargets,
    packRegistry: configState.project?.packRegistry,
    diagnostics,
    manifest,
    // Installed state trails configuration: negative usage evidence would describe the wrong harness.
    installationPending:
      summary !== undefined && summary.create + summary.update + summary.delete > 0,
  });

  return {
    status: statusOf(diagnostics),
    reproducibility,
    readiness: {
      configuration: { state: configurationReady ? "ready" : "not-ready" },
      installation: { state: installationState },
      localPrerequisites: {
        state:
          resolved === undefined
            ? "unknown"
            : localPrerequisitesUnavailable
              ? "not-ready"
              : "ready",
      },
    },
    project: {
      packageManager: project.packageManager.name,
      packageManagerAmbiguous: project.packageManager.ambiguous,
      packageManagerLockfiles: project.packageManager.lockfiles,
      detectedPacks,
      recommendedPacks,
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
      hooks: hookReports,
      agents: agentReports,
    },
    recommendations: { missingPacks },
    targets: targetReports,
    installation: {
      summary,
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
    ...harnessReports,
    diagnostics,
  };
}

/**
 * Compares the project as it resolves now with the complete snapshot the lock recorded.
 *
 * Read-only and local: it loads the lock, builds the same snapshot install records, and reuses
 * core's comparison. Every locked contract failure is an error diagnostic, so `--locked` exits 1
 * without `--check`. A matching snapshot says nothing about installed files; readiness does.
 */
async function checkLockedResolution(input: {
  readonly cwd: string;
  readonly configProject: AgentyxProject | undefined;
  readonly resolved: ReturnType<typeof resolveAgentyxConfig> | undefined;
  readonly diagnostics: DoctorDiagnostic[];
}): Promise<DoctorReproducibility> {
  const fail = (
    state: ReproducibilityState,
    code: string,
    message: string,
    differences: readonly ResolutionDifference[] = [],
  ): DoctorReproducibility => {
    input.diagnostics.push({ level: "error", code, message });

    return { checked: true, state, differences };
  };
  let lock: Awaited<ReturnType<typeof loadInstallManifestState>>;

  try {
    lock = await loadInstallManifestState(input.cwd);
  } catch (cause) {
    if (
      cause instanceof AgentyxManifestParseError ||
      cause instanceof AgentyxManifestValidationError
    ) {
      // The unreadable lock is already an error diagnostic of the ordinary report.
      return { checked: true, state: "unavailable", differences: [] };
    }

    throw cause;
  }

  if (!lock.present) {
    return fail(
      "missing-lock",
      "locked_manifest_missing",
      "--locked needs .agentyx.lock.json. Run a reviewed full config-based agentyx install or agentyx sync first.",
    );
  }

  if (lock.manifest.version === 1) {
    return fail(
      "legacy-lock",
      "locked_manifest_legacy",
      "The lock is version 1 and records no resolution snapshot. Migrate it with: agentyx install --migrate-lock",
    );
  }

  if (lock.manifest.resolution === null) {
    return fail(
      "snapshot-unavailable",
      "locked_resolution_missing",
      "The lock records no complete resolution snapshot. Run a full config-based agentyx sync or agentyx install to recreate it.",
    );
  }

  if (input.configProject === undefined || input.resolved === undefined) {
    if (!input.diagnostics.some((diagnostic) => diagnostic.level === "error")) {
      input.diagnostics.push({
        level: "error",
        code: "locked_inputs_unavailable",
        message: "The current project inputs could not be resolved, so they cannot be compared.",
      });
    }

    return { checked: true, state: "unavailable", differences: [] };
  }

  let current: ResolutionSnapshot;

  try {
    current = createCurrentProjectResolutionSnapshot({
      config: input.configProject.config,
      resolved: input.resolved,
      packRegistry: input.configProject.packRegistry,
      skillRegistry: input.configProject.skillRegistry,
    });
  } catch (cause) {
    if (!(cause instanceof AgentyxError)) {
      throw cause;
    }

    input.diagnostics.push({ level: "error", code: cause.code, message: cause.message });

    return { checked: true, state: "unavailable", differences: [] };
  }

  const differences = compareResolutionSnapshots(lock.manifest.resolution, current);

  if (differences.length === 0) {
    return { checked: true, state: "matching", differences };
  }

  return fail(
    "mismatch",
    "locked_resolution_mismatch",
    `Current inputs differ from the locked resolution (${differences.length} difference${
      differences.length === 1 ? "" : "s"
    }). Review them, then run agentyx sync or agentyx install to accept a new lock.`,
    differences,
  );
}

function renderReproducibility(report: DoctorReproducibility): string[] {
  const lines = report.differences.slice(0, 10).map((difference) => describeDifference(difference));
  const omitted = report.differences.length - lines.length;

  return [
    section("Locked resolution", [
      report.state,
      ...lines,
      ...(omitted > 0 ? [`… and ${omitted} more`] : []),
    ]),
    "",
  ];
}

export function renderDoctorReport(report: DoctorReport, json: boolean): string {
  if (json) {
    return toJson(report);
  }

  return [
    `Agentyx doctor: ${report.status}`,
    "",
    ...(report.reproducibility.checked ? renderReproducibility(report.reproducibility) : []),
    section("Readiness", [
      `configuration: ${report.readiness.configuration.state}`,
      `installation: ${report.readiness.installation.state}`,
      `local prerequisites: ${report.readiness.localPrerequisites.state}`,
      "runtime: MCP execution, connectivity and authorization not verified",
    ]),
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
      `hooks: ${
        report.resolution.hooks
          .map((hook) => `${hook.name} (${hook.active ? "active" : "disabled"})`)
          .join(", ") || "none"
      }`,
    ]),
    section(
      "Suggestions",
      report.recommendations.missingPacks.map((pack) => `${pack.name} — ${pack.reasons.join(" ")}`),
    ),
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
    ...renderHarnessSections(report),
    section(
      "Diagnostics",
      report.diagnostics.map(
        (diagnostic) => `${diagnostic.level.toUpperCase()}: ${diagnostic.message}`,
      ),
    ),
  ].join("\n");
}

function renderHarnessSections(report: DoctorReport): string[] {
  const { footprint } = report.harness;
  const { providers } = report.observation;
  const sessions = report.observation.currentBaseline.sessions;
  const utilization = report.utilization;
  const percent = (rate: number | null): string =>
    rate === null ? "" : `${Math.round(rate * 100)}%`;
  const cleanup = utilization.capabilities.filter(
    (capability) => capability.kind === "mcp" && capability.state === "dormant-candidate",
  );
  const packLines = utilization.packs.map((pack) => {
    if (pack.evidence === "unavailable") {
      return `${pack.name}: usage unavailable — not reliably observable for the configured providers`;
    }

    if (utilization.negativeEvidence === "paused-pending-install" && pack.eligibleSessions === 0) {
      return `${pack.name}: usage paused — installation is pending, so old sessions describe a different harness`;
    }

    if (sessions === 0) {
      return `${pack.name}: no sessions in the current harness yet (${pack.evidence} visibility)`;
    }

    return pack.evidence === "strong"
      ? `${pack.name}: observed in ${pack.observedSessions} / ${pack.eligibleSessions} observable sessions (${percent(pack.observedSessionRate)} observed session rate)`
      : `${pack.name}: partial visibility — activity seen in ${pack.observedSessions} session(s)${
          pack.observedCapabilities.length > 0 ? ` (${pack.observedCapabilities.join(", ")})` : ""
        }; no rate`;
  });

  return [
    section("Harness", [
      `configured packs: ${footprint.packs.configured} (project recommends ${footprint.breadth.recommended})`,
      `skills: ${footprint.skills}`,
      `MCP servers: ${footprint.mcp.active} active / ${footprint.mcp.declared} declared`,
      `local tools: ${footprint.tools.active} active / ${footprint.tools.declared} declared`,
      `hooks: ${footprint.hooks.active} active / ${footprint.hooks.declared} declared`,
      `agents: ${report.resolution.agents.filter((agent) => agent.active).length} active / ${report.resolution.agents.length} declared`,
    ]),
    section(
      "Agents",
      report.resolution.agents.map(
        (agent) =>
          `${agent.name}: ${agent.targets.map((target) => `${target.target} ${target.state}`).join(", ")}`,
      ),
    ),
    section("Context surface (qualitative, not token counts)", [
      `low-cost MCP: ${footprint.contextSurface.low}`,
      `medium-cost MCP: ${footprint.contextSurface.medium}`,
      `high-cost MCP: ${footprint.contextSurface.high}`,
      ...footprint.contextSurface.servers
        .filter((server) => server.contextCost === "high" || server.contextCost === "medium")
        .map((server) => {
          const usage = utilization.capabilities.find(
            (capability) => capability.kind === "mcp" && capability.name === server.name,
          );

          return `${server.name}: ${server.contextCost}${
            usage !== undefined && usage.eligibleSessions > 0
              ? ` — ${usage.observedSessions} / ${usage.eligibleSessions} observable sessions with calls`
              : ""
          }`;
        }),
    ]),
    section("Observation (local only; metadata, never prompts, code or tool output)", [
      `current baseline: ${report.observation.currentBaseline.fingerprint?.slice(0, 8) ?? "none (nothing installed)"}`,
      `current sessions: ${sessions}`,
      ...(report.observation.historicalSessions + report.observation.unbaselinedSessions > 0
        ? [
            `historical sessions ignored: ${
              report.observation.historicalSessions + report.observation.unbaselinedSessions
            }`,
          ]
        : []),
      ...(report.observation.negativeEvidence === "paused-pending-install"
        ? [
            "utilization paused for negative recommendations until installed state matches configuration (run agentyx install)",
          ]
        : []),
      ...(report.observation.store.legacyData
        ? [`legacy usage-v1.jsonl found and ignored (sessions were not tied to a harness)`]
        : []),
      ...providers.map((provider) =>
        provider.runtimeObservation === "unavailable"
          ? `${provider.name}: static only — runtime usage observation unavailable (${provider.reason ?? "no project-local hooks"})`
          : `${provider.name}: ${provider.currentBaselineSessions} current session(s) of ${provider.sessions} recorded, capability visibility ${provider.visibility}, observer ${provider.coverage}; hooks ${
              provider.hooks?.configured === true ? "configured" : "not configured"
            }${provider.hooks?.trust === "review-may-be-required" ? ", user review may be required" : ""}${
              provider.lastReportedContextTokens === undefined
                ? ""
                : `; last provider-reported context: ${Math.round(provider.lastReportedContextTokens / 1000)}k tokens`
            }${provider.reason === undefined ? "" : `; ${provider.reason}`}`,
      ),
      report.observation.store.location === "unavailable"
        ? "no Git checkout: nothing is recorded (Agentyx never writes to $HOME)"
        : "state: Git-local, never committed",
    ]),
    section(`Pack activity — observed session rate, ${sessions} current session(s)`, [
      ...(sessions > 0
        ? [
            "rate = sessions with observed activity / sessions that could show it; not token or cost share",
          ]
        : []),
      ...packLines,
    ]),
    section(
      "Potential cleanup",
      cleanup.map(
        (capability) =>
          `${capability.name}: ${capability.contextCost ?? "unclassified"} context cost, ${capability.observedCalls} observed calls / ${capability.eligibleSessions} current-harness observable sessions`,
      ),
    ),
  ];
}

/**
 * The `SessionStart` hook's own output: silent when healthy, one short line
 * otherwise.
 *
 * A `SessionStart` hook's stdout is injected into the agent's context verbatim
 * on exit 0 — empty stdout adds nothing, so a healthy project costs zero
 * tokens at session start. A problem gets exactly one line pointing at
 * `agentyx doctor` for the full report, never the report itself.
 */
export function renderDoctorHookOutput(report: DoctorReport): string {
  if (report.status === "healthy") {
    return "";
  }

  const errors = report.diagnostics.filter((diagnostic) => diagnostic.level === "error").length;
  const warnings = report.diagnostics.filter((diagnostic) => diagnostic.level === "warning").length;
  const parts = [
    errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : undefined,
    warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : undefined,
  ].filter((part) => part !== undefined);

  return `Agentyx: ${parts.join(", ")} — run \`agentyx doctor\` for details.`;
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
  readonly project: AgentyxProject | undefined;
  readonly error: DoctorDiagnostic | undefined;
}> {
  try {
    const project = await loadAgentyxProject(projectDir);

    return {
      present: true,
      valid: true,
      config: project.config,
      project,
      error: undefined,
    };
  } catch (cause) {
    if (cause instanceof AgentyxConfigNotFoundError) {
      return {
        present: false,
        valid: false,
        config: undefined,
        project: undefined,
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
        project: undefined,
        error: {
          level: "error",
          code: cause.code,
          message: cause.message,
        },
      };
    }

    if (cause instanceof AgentyxError) {
      return {
        present: true,
        valid: false,
        config: undefined,
        project: undefined,
        error: { level: "error", code: cause.code, message: cause.message },
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

function mcpUnsupportedDiagnostic(
  target: string,
  server: McpServerDefinition,
  requirement: "transport" | "scope",
): DoctorDiagnostic {
  const detail =
    requirement === "transport" ? `transport "${server.transport}"` : "project MCP scope";

  return {
    level: "error",
    code: "mcp_unsupported",
    message: `MCP server "${server.name}" requires ${detail}, which target "${target}" does not support.`,
    capability: { kind: "mcp", name: server.name },
    target,
    requirement:
      requirement === "transport"
        ? { kind: requirement, name: server.transport }
        : { kind: requirement },
  };
}

function planningDiagnostic(cause: unknown): DoctorDiagnostic | undefined {
  if (cause instanceof ProviderConfigParseError) {
    return { level: "error", code: cause.code, message: cause.message };
  }

  if (cause instanceof UnsupportedMcpTransportError) {
    return {
      level: "error",
      code: "mcp_unsupported",
      message: cause.message,
      capability: { kind: "mcp", name: cause.server },
      target: cause.adapterId,
      requirement: { kind: "transport", name: cause.transport },
    };
  }

  if (cause instanceof UnsupportedMcpEnvReferenceError) {
    return {
      level: "error",
      code: cause.code,
      message: cause.message,
      capability: { kind: "mcp", name: cause.server },
      target: cause.adapterId,
      requirement: { kind: "environment" },
    };
  }

  return cause instanceof AgentyxError
    ? { level: "error", code: cause.code, message: cause.message }
    : undefined;
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

/**
 * Whether `npx` would find `bin` without a registry lookup: a direct check of
 * `node_modules/.bin`, the same place `npx` resolves a project-local binary from before ever
 * considering a download.
 */
async function projectLocalBinaryAvailable(projectDir: string, bin: string): Promise<boolean> {
  const candidates = process.platform === "win32" ? [bin, `${bin}.cmd`, `${bin}.CMD`] : [bin];

  for (const candidate of candidates) {
    if (await fileExists(join(projectDir, "node_modules", ".bin", candidate))) {
      return true;
    }
  }

  return false;
}

function displayPath(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Inspect Agentyx configuration, resolution, targets and installability.")
    .option("--json", "print machine-readable JSON only", false)
    .option("--check", "exit with code 1 on warnings as well as errors", false)
    .option(
      "--locked",
      "compare current harness inputs with the complete lock snapshot; exits 1 on any mismatch",
      false,
    )
    .option(
      "--hook",
      "print a one-line SessionStart hook summary instead of the full report; nothing when healthy",
      false,
    )
    .action(async (options: { json: boolean; check: boolean; hook: boolean; locked: boolean }) => {
      if (options.hook && options.locked) {
        await emit(() => {
          throw new AgentyxError(
            "doctor_hook_locked_conflict",
            "--hook prints a one-line summary and cannot be combined with --locked.",
          );
        });

        return;
      }

      const report = await runDoctorCommand({
        json: options.json,
        cwd: process.cwd(),
        locked: options.locked,
      });

      if (options.hook) {
        const output = renderDoctorHookOutput(report);

        if (output.length > 0) {
          process.stdout.write(`${output}\n`);
        }

        return;
      }

      process.stdout.write(`${renderDoctorReport(report, options.json)}\n`);

      process.exitCode = doctorExitCode(report, options.check);
    });
}
