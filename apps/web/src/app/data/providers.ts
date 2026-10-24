/**
 * What Agentyx can install into each provider, and where.
 *
 * Every value here mirrors `docs/compatibility.md`, which is itself checked against each provider's
 * official documentation. Nothing on the site may claim a capability this table does not carry.
 */
export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly skills: string;
  readonly agents: string;
  readonly mcp: string;
  /** `null` means the provider supports hooks but Agentyx deliberately installs none. */
  readonly hooks: string | null;
  readonly hooksNote?: string;
  /** Whether MCP servers and hooks share one document, which Agentyx writes as a single merge. */
  readonly sharedSettings?: boolean;
  readonly observability: {
    readonly sessionLifecycle: boolean;
    readonly toolUse: boolean;
    readonly skillUse: boolean;
    readonly mcpUse: boolean;
    readonly contextTokens: boolean;
  };
  readonly notes?: string;
}

export const PROVIDERS: readonly Provider[] = [
  {
    id: "codex",
    name: "Codex",
    skills: ".agents/skills",
    agents: ".codex/agents/<name>.toml",
    mcp: ".codex/config.toml",
    hooks: ".codex/hooks.json",
    observability: {
      sessionLifecycle: true,
      toolUse: true,
      skillUse: false,
      mcpUse: true,
      contextTokens: false,
    },
    notes:
      "Codex documents no Skill usage signal, so Skill activity is reported as unobservable rather than as zero use. Project hooks need your review and trust through /hooks, so Agentyx reports them as configured, never as active.",
  },
  {
    id: "claude",
    name: "Claude Code",
    skills: ".claude/skills",
    agents: ".claude/agents/<name>.md",
    mcp: ".mcp.json",
    hooks: ".claude/settings.json",
    observability: {
      sessionLifecycle: true,
      toolUse: true,
      skillUse: true,
      mcpUse: true,
      contextTokens: true,
    },
    notes:
      "The most observable target: Skill use through the Skill tool or a typed /skill, and a context size on resumed or forked sessions.",
  },
  {
    id: "kimi",
    name: "Kimi Code",
    skills: ".agents/skills",
    agents: ".agents/agents/<name>.md",
    mcp: ".kimi-code/mcp.json",
    hooks: null,
    hooksNote: "user-level config only — Agentyx installs none",
    observability: {
      sessionLifecycle: false,
      toolUse: false,
      skillUse: false,
      mcpUse: false,
      contextTokens: false,
    },
    notes:
      "Kimi Code supports hooks, but only in ~/.kimi-code/config.toml. Agentyx never writes under $HOME, so this is a policy limit, not a provider limit: Kimi gets the full static analysis and no runtime observation.",
  },
  {
    id: "qwen",
    name: "Qwen Code",
    skills: ".qwen/skills",
    agents: ".qwen/agents/<name>.md",
    mcp: ".qwen/settings.json",
    hooks: ".qwen/settings.json",
    sharedSettings: true,
    observability: {
      sessionLifecycle: true,
      toolUse: true,
      skillUse: false,
      mcpUse: true,
      contextTokens: false,
    },
    notes:
      "Qwen Code reads MCP servers and hooks from one document, so Agentyx plans and writes it as a single merge under one lock entry. It documents no Skill tool, so a model-selected Skill leaves no signal and Skill use stays unobservable. Project hooks load only for a folder you have trusted.",
  },
];

/** Rows of the capability matrix, so the table reads the same on every screen size. */
export const CAPABILITY_ROWS = [
  { label: "Project Skills", key: "skills" },
  { label: "Project agents", key: "agents" },
  { label: "MCP configuration", key: "mcp" },
  { label: "Lifecycle hooks", key: "hooks" },
] as const;

export const OBSERVABILITY_ROWS = [
  { label: "Session lifecycle", key: "sessionLifecycle" },
  { label: "Tool use", key: "toolUse" },
  { label: "Skill use", key: "skillUse" },
  { label: "MCP use", key: "mcpUse" },
  { label: "Context size", key: "contextTokens" },
] as const;
