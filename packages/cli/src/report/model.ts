import { access, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  AgentyxManifestParseError,
  AgentyxManifestValidationError,
  builtInMcpServerRegistry,
  explainAgentyxResolution,
  type InstallManifestEntry,
  loadAgentyxProject,
  loadInstallManifestState,
  type ResolutionExplanationEntry,
  renderProjectGraphSvg,
  resolveAgentyxConfig,
} from "@agentyx/core";
import {
  type DoctorLevel,
  type DoctorReport,
  type DoctorStatus,
  type ReadinessState,
  type ReproducibilityState,
  runDoctorCommand,
} from "../commands/doctor.js";
import { describeDifference } from "../snapshot.js";
import { cliVersion } from "../version.js";

export type CapabilityKind = ResolutionExplanationEntry["kind"];
export type CapabilityReason = ResolutionExplanationEntry["reason"];
/** Whether Agentyx can render the capability for a provider; never proof that it runs there. */
export type RenderSupport = "renderable" | "unsupported" | "not-applicable";
export type ObservationState = "observed" | "not-observed" | "unobservable";
export type OwnershipKind = InstallManifestEntry["kind"];
export type OwnershipState = "recorded" | "missing" | "drifted" | "stale";

export interface ReportCapability {
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly active: boolean;
  readonly activation: "default" | "optional";
  readonly reason: CapabilityReason;
  /** Contributing pack names, in resolution order. */
  readonly packs: readonly string[];
  readonly projectContext: boolean;
  readonly targets: readonly { readonly target: string; readonly support: RenderSupport }[];
}

export interface ReportProvider {
  readonly id: string;
  readonly name: string;
  readonly known: boolean;
  readonly skillsPath: string | undefined;
  readonly mcp: { readonly project: boolean; readonly transports: readonly string[] };
  readonly hooks: boolean;
  readonly agents: boolean;
  readonly observation: {
    readonly state: ObservationState;
    readonly sessions: number;
    readonly coverage: "active" | "partial" | "unavailable";
  };
}

export interface ReportDiagnostic {
  readonly level: DoctorLevel;
  readonly code: string;
  readonly message: string;
}

export interface ReportOwnershipEntry {
  readonly kind: OwnershipKind;
  readonly path: string;
  readonly names: readonly string[];
  readonly targets: readonly string[];
  readonly state: OwnershipState;
}

export interface ReportModel {
  readonly schemaVersion: 1;
  readonly agentyxVersion: string;
  readonly project: {
    readonly name: string | undefined;
    readonly id: string | undefined;
    readonly description: string | undefined;
    readonly owns: readonly string[];
    readonly relationCount: number;
  };
  readonly overview: {
    readonly doctorStatus: DoctorStatus;
    readonly readiness: {
      readonly configuration: ReadinessState;
      readonly installation: ReadinessState;
      readonly localPrerequisites: ReadinessState;
    };
    readonly reproducibility: ReproducibilityState;
    readonly targets: readonly string[];
    readonly active: Readonly<Record<CapabilityKind, number>>;
  };
  readonly desired: {
    readonly packs: readonly string[];
    readonly targets: readonly string[];
    readonly enabled: readonly string[];
    readonly excluded: readonly { readonly kind: CapabilityKind; readonly name: string }[];
    readonly localPacks: number;
    readonly skillDirectories: number;
    readonly projectContext: boolean;
    readonly relations: number;
  };
  readonly harness: readonly ReportCapability[];
  readonly providers: readonly ReportProvider[];
  readonly readiness: { readonly diagnostics: readonly ReportDiagnostic[] };
  readonly reproducibility: {
    readonly state: ReproducibilityState;
    readonly lock: "absent" | "unreadable" | "present";
    readonly lockVersion: 1 | 2 | undefined;
    readonly snapshot: "complete" | "unavailable";
    readonly differences: readonly string[];
  };
  /** Manifest evidence only: a resolved capability never appears here unless the lock records it. */
  readonly installation: {
    readonly lock: "absent" | "unreadable" | "present";
    readonly summary: DoctorReport["installation"]["summary"];
    readonly entries: readonly ReportOwnershipEntry[];
  };
  readonly graph: { readonly svg: string | undefined; readonly relations: number };
}

const KINDS: readonly CapabilityKind[] = ["skill", "mcp", "tool", "hook", "agent"];

/**
 * Collects the report from the project's existing domain state.
 *
 * Read-only: it loads configuration, runs Doctor's builder in-process (twice, because the locked
 * comparison turns lock problems into error diagnostics that Doctor's own status must not carry)
 * and reads the lock. A missing or invalid `.agentyx.json` throws the loader's domain error.
 */
export async function buildReportModel(cwd: string): Promise<ReportModel> {
  const project = await loadAgentyxProject(cwd);
  const resolved = resolveAgentyxConfig(
    project.config,
    project.packRegistry,
    project.skillRegistry,
  );
  const doctor = await runDoctorCommand({ cwd, json: false });
  const locked = await runDoctorCommand({ cwd, json: false, locked: true });
  const explanation = explainAgentyxResolution(resolved, project.packRegistry);
  const lockState = await readLock(cwd);
  const config = project.config;
  const sanitize = createPathSanitizer([cwd, await realpath(cwd).catch(() => cwd)]);
  const targets = resolved.targets;

  const harness = explanation.map(
    (entry): ReportCapability => ({
      kind: entry.kind,
      name: entry.name,
      active: entry.active,
      activation: entry.activation,
      reason: entry.reason,
      packs: entry.origins.flatMap((origin) => (origin.kind === "pack" ? [origin.name] : [])),
      projectContext: entry.origins.some((origin) => origin.kind === "project-context"),
      targets: targets.map((target) => ({
        target,
        support: renderSupport(entry.kind, entry.name, target),
      })),
    }),
  );
  const active = Object.fromEntries(
    KINDS.map((kind) => [kind, harness.filter((e) => e.kind === kind && e.active).length]),
  ) as Record<CapabilityKind, number>;
  const lockVersion = lockState.manifest?.version;

  return {
    schemaVersion: 1,
    agentyxVersion: cliVersion,
    project: {
      name: config.project?.name,
      id: config.project?.id,
      description: config.project?.description,
      owns: config.project?.owns ?? [],
      relationCount: config.relations?.length ?? 0,
    },
    overview: {
      doctorStatus: doctor.status,
      readiness: {
        configuration: doctor.readiness.configuration.state,
        installation: doctor.readiness.installation.state,
        localPrerequisites: doctor.readiness.localPrerequisites.state,
      },
      reproducibility: locked.reproducibility.state,
      targets,
      active,
    },
    desired: {
      packs: config.packs,
      targets: config.targets,
      enabled: config.enable,
      excluded: [
        ...(config.exclude?.skills ?? []).map((name) => ({ kind: "skill" as const, name })),
        ...(config.exclude?.mcpServers ?? []).map((name) => ({ kind: "mcp" as const, name })),
        ...(config.exclude?.tools ?? []).map((name) => ({ kind: "tool" as const, name })),
        ...(config.exclude?.hooks ?? []).map((name) => ({ kind: "hook" as const, name })),
        ...(config.exclude?.agents ?? []).map((name) => ({ kind: "agent" as const, name })),
      ],
      localPacks: config.localPacks?.length ?? 0,
      skillDirectories: config.skillDirectories?.length ?? 0,
      projectContext: config.context !== undefined,
      relations: config.relations?.length ?? 0,
    },
    harness,
    providers: targets.map((target) => providerFor(target, doctor)),
    readiness: {
      diagnostics: doctor.diagnostics.map((diagnostic) => ({
        level: diagnostic.level,
        code: diagnostic.code,
        message: sanitize(diagnostic.message),
      })),
    },
    reproducibility: {
      state: locked.reproducibility.state,
      lock: lockState.kind,
      lockVersion,
      snapshot:
        lockState.manifest?.version === 2 && lockState.manifest.resolution !== null
          ? "complete"
          : "unavailable",
      differences: locked.reproducibility.differences.map(describeDifference),
    },
    installation: {
      lock: lockState.kind,
      summary: doctor.installation.summary,
      entries: await ownershipEntries(cwd, lockState.manifest?.entries ?? [], doctor),
    },
    graph: {
      svg: project.graph === undefined ? undefined : renderProjectGraphSvg(project.graph),
      relations: project.graph?.relations.length ?? 0,
    },
  };
}

type LockState =
  | { readonly kind: "absent" | "unreadable"; readonly manifest: undefined }
  | {
      readonly kind: "present";
      readonly manifest: Awaited<ReturnType<typeof loadInstallManifestState>>["manifest"];
    };

async function readLock(cwd: string): Promise<LockState> {
  try {
    const state = await loadInstallManifestState(cwd);

    return state.present
      ? { kind: "present", manifest: state.manifest }
      : { kind: "absent", manifest: undefined };
  } catch (cause) {
    if (
      cause instanceof AgentyxManifestParseError ||
      cause instanceof AgentyxManifestValidationError
    ) {
      return { kind: "unreadable", manifest: undefined };
    }

    throw cause;
  }
}

function renderSupport(kind: CapabilityKind, name: string, target: string): RenderSupport {
  if (!builtInAdapterRegistry.has(target)) return "unsupported";

  const capabilities = builtInAdapterRegistry.get(target).capabilities;

  switch (kind) {
    case "skill":
      return capabilities.skills ? "renderable" : "unsupported";
    case "hook":
      return capabilities.hooks ? "renderable" : "unsupported";
    case "agent":
      return capabilities.agents ? "renderable" : "unsupported";
    case "mcp": {
      if (!capabilities.mcp.project) return "unsupported";
      if (!builtInMcpServerRegistry.has(name)) return "renderable";
      const transport = builtInMcpServerRegistry.get(name).transport;

      return capabilities.mcp.transports === undefined ||
        capabilities.mcp.transports.includes(transport)
        ? "renderable"
        : "unsupported";
    }
    case "tool":
      return "not-applicable";
  }
}

function providerFor(target: string, doctor: DoctorReport): ReportProvider {
  const report = doctor.targets.find((item) => item.id === target);

  if (!builtInAdapterRegistry.has(target)) {
    return {
      id: target,
      name: target,
      known: false,
      skillsPath: undefined,
      mcp: { project: false, transports: [] },
      hooks: false,
      agents: false,
      observation: { state: "unobservable", sessions: 0, coverage: "unavailable" },
    };
  }

  const adapter = builtInAdapterRegistry.get(target);
  const observed = doctor.observation.providers.find((provider) => provider.id === target);
  const sessions = observed?.sessions ?? 0;

  return {
    id: target,
    name: adapter.name,
    known: true,
    skillsPath: report?.skillsPath,
    mcp: {
      project: adapter.capabilities.mcp.project,
      transports: adapter.capabilities.mcp.transports ?? [],
    },
    hooks: adapter.capabilities.hooks,
    agents: adapter.capabilities.agents,
    observation: {
      state:
        observed === undefined || observed.visibility === "unavailable"
          ? "unobservable"
          : sessions > 0
            ? "observed"
            : "not-observed",
      sessions,
      coverage: observed?.coverage ?? "unavailable",
    },
  };
}

async function ownershipEntries(
  cwd: string,
  entries: readonly InstallManifestEntry[],
  doctor: DoctorReport,
): Promise<ReportOwnershipEntry[]> {
  const { drifted, stale } = doctor.installation.manifest;
  const result: ReportOwnershipEntry[] = [];

  for (const entry of entries) {
    const exists = await access(join(cwd, entry.path)).then(
      () => true,
      () => false,
    );

    result.push({
      kind: entry.kind,
      path: entry.path,
      names:
        entry.kind === "skill"
          ? [entry.skill]
          : entry.kind === "agent"
            ? [entry.agent]
            : entry.kind === "mcp"
              ? entry.servers
              : entry.hooks,
      targets: entry.targets,
      state: !exists
        ? "missing"
        : drifted.includes(entry.path)
          ? "drifted"
          : stale.includes(entry.path)
            ? "stale"
            : "recorded",
    });
  }

  return result.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

/** Diagnostics are Doctor's own wording; this only keeps machine-specific paths out of them. */
function createPathSanitizer(roots: readonly string[]): (message: string) => string {
  const replacements: [string, string][] = roots.map((root) => [root, "."]);
  const home = homedir();

  if (home.length > 1) replacements.push([home, "~"]);

  replacements.sort((a, b) => b[0].length - a[0].length);

  return (message) => replacements.reduce((text, [from, to]) => text.split(from).join(to), message);
}
