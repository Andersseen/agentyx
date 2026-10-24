import type {
  CapabilityKind,
  CapabilityReason,
  ObservationState,
  OwnershipKind,
  OwnershipState,
  RenderSupport,
  ReportModel,
} from "./model.js";

/**
 * What the Flowview template reads: the report model with its words, tones and sort keys
 * decided. The template does no logic beyond looping and branching on these fields.
 */
export type Tone = "ok" | "warn" | "bad" | "unknown" | "muted";

export interface Badge {
  readonly tone: Tone;
  /** A glyph, so state is never carried by colour alone. */
  readonly symbol: string;
  readonly label: string;
}

export interface ReportView {
  readonly documentTitle: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly description: string;
  readonly version: string;
  readonly cards: readonly {
    readonly label: string;
    readonly badge: Badge;
    readonly note: string;
  }[];
  readonly targets: readonly { readonly id: string; readonly name: string }[];
  readonly counts: readonly { readonly label: string; readonly value: number }[];
  readonly desired: {
    readonly rows: readonly { readonly label: string; readonly values: readonly string[] }[];
    readonly projectContext: string;
    readonly relations: number;
  };
  readonly harness: {
    readonly total: number;
    readonly groups: readonly {
      readonly kind: CapabilityKind;
      readonly title: string;
      readonly active: number;
      readonly entries: readonly {
        readonly kind: CapabilityKind;
        readonly name: string;
        readonly stateKey: "selected" | "available" | "excluded";
        readonly badge: Badge;
        readonly why: string;
        readonly origins: string;
        readonly search: string;
        readonly coverage: readonly { readonly target: string; readonly label: string }[];
      }[];
    }[];
  };
  readonly providers: readonly {
    readonly id: string;
    readonly name: string;
    readonly skills: string;
    readonly mcp: string;
    readonly hooks: string;
    readonly agents: string;
    readonly observation: Badge;
    readonly observationNote: string;
  }[];
  readonly readiness: {
    readonly rows: readonly { readonly label: string; readonly badge: Badge }[];
    readonly doctor: Badge;
    readonly diagnostics: readonly {
      readonly badge: Badge;
      readonly code: string;
      readonly message: string;
    }[];
  };
  readonly reproducibility: {
    readonly badge: Badge;
    readonly explanation: string;
    readonly lock: string;
    readonly snapshot: string;
    readonly differences: readonly string[];
    readonly installation: Badge;
  };
  readonly installation: {
    readonly lock: string;
    readonly summary: string;
    readonly total: number;
    readonly groups: readonly {
      readonly title: string;
      readonly entries: readonly {
        readonly path: string;
        readonly names: string;
        readonly targets: string;
        readonly badge: Badge;
      }[];
    }[];
  };
  readonly graph: {
    readonly configured: boolean;
    readonly svg: string;
    readonly relations: number;
  };
}

const KIND_TITLES: Readonly<Record<CapabilityKind, string>> = {
  skill: "Skills",
  mcp: "MCP servers",
  tool: "Tools",
  hook: "Hooks",
  agent: "Agents",
};
const KIND_ORDER: readonly CapabilityKind[] = ["skill", "mcp", "tool", "hook", "agent"];

const READINESS: Readonly<Record<string, Badge>> = {
  ready: { tone: "ok", symbol: "✓", label: "Ready" },
  "not-ready": { tone: "bad", symbol: "✕", label: "Not ready" },
  unknown: { tone: "unknown", symbol: "?", label: "Unknown" },
};

const REPRODUCIBILITY: Readonly<Record<string, { badge: Badge; explanation: string }>> = {
  matching: {
    badge: { tone: "ok", symbol: "✓", label: "Matching" },
    explanation:
      "Current inputs resolve to the complete snapshot recorded in the lock. This describes reviewed inputs, not installed files.",
  },
  mismatch: {
    badge: { tone: "bad", symbol: "✕", label: "Differs" },
    explanation: "Current inputs differ from the locked resolution. Review the differences below.",
  },
  "missing-lock": {
    badge: { tone: "warn", symbol: "!", label: "No lock" },
    explanation: "No .agentyx.lock.json exists, so there is no reviewed resolution to compare.",
  },
  "legacy-lock": {
    badge: { tone: "warn", symbol: "!", label: "Legacy lock" },
    explanation: "The lock is version 1 and records no resolution snapshot.",
  },
  "snapshot-unavailable": {
    badge: { tone: "warn", symbol: "!", label: "No snapshot" },
    explanation: "The lock records no complete resolution snapshot.",
  },
  unavailable: {
    badge: { tone: "unknown", symbol: "?", label: "Unavailable" },
    explanation: "The lock or the current inputs could not be compared.",
  },
  "not-checked": {
    badge: { tone: "unknown", symbol: "?", label: "Not checked" },
    explanation: "The locked comparison was not run.",
  },
};

const REASONS: Readonly<Record<CapabilityReason, { badge: Badge; why: string }>> = {
  default: {
    badge: { tone: "ok", symbol: "✓", label: "Selected" },
    why: "Active by default in a selected pack.",
  },
  "explicitly-enabled": {
    badge: { tone: "ok", symbol: "✓", label: "Selected" },
    why: "Optional in its pack and explicitly enabled.",
  },
  "project-context": {
    badge: { tone: "ok", symbol: "✓", label: "Selected" },
    why: "Generated from the project context configuration.",
  },
  "optional-disabled": {
    badge: { tone: "muted", symbol: "○", label: "Available, disabled" },
    why: "Optional in a selected pack and not enabled.",
  },
  excluded: {
    badge: { tone: "warn", symbol: "−", label: "Excluded" },
    why: "Removed by an exclusion in the project configuration.",
  },
};

const OBSERVATION: Readonly<Record<ObservationState, { badge: Badge; note: string }>> = {
  observed: {
    badge: { tone: "ok", symbol: "✓", label: "Sessions recorded" },
    note: "Local hooks recorded sessions for this provider.",
  },
  "not-observed": {
    badge: { tone: "unknown", symbol: "○", label: "None recorded" },
    note: "No recorded sessions. This does not mean the harness is unused.",
  },
  unobservable: {
    badge: { tone: "unknown", symbol: "?", label: "Not observable" },
    note: "Agentyx cannot reliably observe sessions for this provider.",
  },
};

const OWNERSHIP_STATE: Readonly<Record<OwnershipState, Badge>> = {
  recorded: { tone: "ok", symbol: "✓", label: "Recorded" },
  missing: { tone: "bad", symbol: "✕", label: "Missing on disk" },
  drifted: { tone: "warn", symbol: "!", label: "Edited since written" },
  stale: { tone: "warn", symbol: "!", label: "No longer resolved" },
};

const OWNERSHIP_TITLES: Readonly<Record<OwnershipKind, string>> = {
  skill: "Skill files",
  agent: "Agent files",
  mcp: "MCP configuration",
  hook: "Hook configuration",
  settings: "Provider settings (MCP + hooks)",
};

const SUPPORT_LABEL: Readonly<Record<RenderSupport, string>> = {
  renderable: "renderable",
  unsupported: "unsupported",
  "not-applicable": "n/a",
};

const LEVEL_BADGE: Readonly<Record<string, Badge>> = {
  info: { tone: "unknown", symbol: "i", label: "Info" },
  warning: { tone: "warn", symbol: "!", label: "Warning" },
  error: { tone: "bad", symbol: "✕", label: "Error" },
};

const DOCTOR_BADGE: Readonly<Record<string, Badge>> = {
  healthy: { tone: "ok", symbol: "✓", label: "Healthy" },
  warnings: { tone: "warn", symbol: "!", label: "Warnings" },
  errors: { tone: "bad", symbol: "✕", label: "Errors" },
};

const FALLBACK_BADGE: Badge = { tone: "unknown", symbol: "?", label: "Unknown" };

function pick<T>(table: Readonly<Record<string, T>>, key: string, fallback: T): T {
  return table[key] ?? fallback;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

export function createReportView(model: ReportModel): ReportView {
  const projectName = model.project.name ?? "Unnamed project";
  const reproducibility = pick(REPRODUCIBILITY, model.reproducibility.state, {
    badge: FALLBACK_BADGE,
    explanation: "",
  });
  const readiness = model.overview.readiness;
  const installationBadge = pick(READINESS, readiness.installation, FALLBACK_BADGE);
  const harnessGroups = KIND_ORDER.map((kind) => {
    const entries = model.harness.filter((entry) => entry.kind === kind);

    return {
      kind,
      title: KIND_TITLES[kind],
      active: entries.filter((entry) => entry.active).length,
      entries: entries.map((entry) => {
        const reason = REASONS[entry.reason];
        const origins = [
          ...entry.packs.map((pack) => `pack ${pack}`),
          ...(entry.projectContext ? ["project context"] : []),
        ];

        return {
          kind,
          name: entry.name,
          stateKey: entry.active
            ? ("selected" as const)
            : entry.reason === "excluded"
              ? ("excluded" as const)
              : ("available" as const),
          badge: reason.badge,
          why: reason.why,
          origins: list(origins),
          search: [entry.name, kind, reason.badge.label, ...origins].join(" ").toLowerCase(),
          coverage: entry.targets.map((item) => ({
            target: item.target,
            label: SUPPORT_LABEL[item.support],
          })),
        };
      }),
    };
  });
  const summary = model.installation.summary;

  return {
    documentTitle: `${projectName} · Agentyx harness report`,
    projectName,
    projectId: model.project.id ?? "",
    description: model.project.description ?? "",
    version: model.agentyxVersion,
    cards: [
      {
        label: "Configuration",
        badge: pick(READINESS, readiness.configuration, FALLBACK_BADGE),
        note: "Valid .agentyx.json with resolvable targets",
      },
      {
        label: "Installation",
        badge: installationBadge,
        note: "Installed files compared with the resolution",
      },
      {
        label: "Prerequisites",
        badge: pick(READINESS, readiness.localPrerequisites, FALLBACK_BADGE),
        note: "Commands and environment names found on this machine",
      },
      {
        label: "Locked resolution",
        badge: reproducibility.badge,
        note: "Current inputs compared with the lock snapshot",
      },
      {
        label: "Doctor status",
        badge: pick(DOCTOR_BADGE, model.overview.doctorStatus, FALLBACK_BADGE),
        note: "Highest diagnostic severity",
      },
    ],
    targets: model.providers.map((provider) => ({ id: provider.id, name: provider.name })),
    counts: KIND_ORDER.map((kind) => ({
      label: KIND_TITLES[kind],
      value: model.overview.active[kind],
    })),
    desired: {
      rows: [
        { label: "Packs", values: model.desired.packs },
        { label: "Targets", values: model.desired.targets },
        { label: "Explicitly enabled", values: model.desired.enabled },
        {
          label: "Excluded",
          values: model.desired.excluded.map((item) => `${item.kind}:${item.name}`),
        },
        {
          label: "Local sources",
          values: [
            ...(model.desired.localPacks > 0 ? [`${model.desired.localPacks} local pack(s)`] : []),
            ...(model.desired.skillDirectories > 0
              ? [`${model.desired.skillDirectories} Skill director(ies)`]
              : []),
          ],
        },
      ],
      projectContext: model.desired.projectContext ? "configured" : "not configured",
      relations: model.desired.relations,
    },
    harness: { total: model.harness.length, groups: harnessGroups },
    providers: model.providers.map((provider) => {
      const observation = OBSERVATION[provider.observation.state];

      return {
        id: provider.id,
        name: provider.known ? provider.name : `${provider.id} (unknown target)`,
        skills: provider.skillsPath ?? "n/a",
        mcp: !provider.mcp.project
          ? "no project MCP configuration"
          : provider.mcp.transports.length === 0
            ? "project configuration"
            : `project configuration · ${provider.mcp.transports.join(", ")}`,
        hooks: provider.hooks ? "renderable" : "unsupported",
        agents: provider.agents ? "renderable" : "unsupported",
        observation: observation.badge,
        observationNote:
          provider.observation.state === "observed"
            ? `${provider.observation.sessions} session(s) recorded · hook coverage ${provider.observation.coverage}`
            : observation.note,
      };
    }),
    readiness: {
      rows: [
        { label: "Configuration", badge: pick(READINESS, readiness.configuration, FALLBACK_BADGE) },
        { label: "Installation", badge: installationBadge },
        {
          label: "Local prerequisites",
          badge: pick(READINESS, readiness.localPrerequisites, FALLBACK_BADGE),
        },
      ],
      doctor: pick(DOCTOR_BADGE, model.overview.doctorStatus, FALLBACK_BADGE),
      diagnostics: model.readiness.diagnostics.map((diagnostic) => ({
        badge: pick(LEVEL_BADGE, diagnostic.level, FALLBACK_BADGE),
        code: diagnostic.code,
        message: diagnostic.message,
      })),
    },
    reproducibility: {
      badge: reproducibility.badge,
      explanation: reproducibility.explanation,
      lock:
        model.reproducibility.lock === "present"
          ? `present · version ${model.reproducibility.lockVersion ?? "unknown"}`
          : model.reproducibility.lock,
      snapshot: model.reproducibility.snapshot,
      differences: model.reproducibility.differences,
      installation: installationBadge,
    },
    installation: {
      lock: model.installation.lock,
      summary:
        summary === undefined
          ? "not planned"
          : `${summary.create} to create · ${summary.update} to update · ${summary.delete} to remove · ${summary.unchanged} unchanged · ${summary.conflict} conflict(s)`,
      total: model.installation.entries.length,
      groups: (["skill", "agent", "mcp", "hook"] as const).map((kind) => ({
        title: OWNERSHIP_TITLES[kind],
        entries: model.installation.entries
          .filter((entry) => entry.kind === kind)
          .map((entry) => ({
            path: entry.path,
            names: list(entry.names),
            targets: list(entry.targets),
            badge: OWNERSHIP_STATE[entry.state],
          })),
      })),
    },
    graph: {
      configured: model.graph.svg !== undefined,
      svg: model.graph.svg ?? "",
      relations: model.graph.relations,
    },
  };
}
