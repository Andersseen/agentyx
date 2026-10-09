import type {
  AgentDefinition,
  HookDefinition,
  McpServerDefinition,
  SkillDefinition,
} from "@agentyx/core";
import type { HookPayloadNormalizer } from "./hook-observer.js";

export interface AdapterCapabilities {
  readonly skills: boolean;
  readonly mcp: {
    readonly project: boolean;
    readonly global: boolean;
    readonly transports?: readonly string[];
  };
  readonly hooks: boolean;
  readonly agents: boolean;
  /** Absent means the adapter declares nothing observable. */
  readonly observability?: AdapterObservability;
}

/**
 * What a provider can reliably show Agentyx about a session, as documented by the provider.
 *
 * Core aggregation consumes these flags; it never branches on a provider id. `reason` explains an
 * absence in one sentence for Doctor.
 */
export interface AdapterObservability {
  /** Agentyx can install project-local hooks for this provider. */
  readonly projectHooks: boolean;
  readonly sessionLifecycle: boolean;
  readonly toolUse: boolean;
  readonly skillUse: boolean;
  readonly mcpUse: boolean;
  /** The provider reports a context size in some lifecycle payload. */
  readonly contextTokens: boolean;
  readonly reason?: string;
}

/**
 * Everything an adapter needs to describe an installation.
 *
 * `skills` are already-resolved, provider-independent `SkillDefinition`s: the
 * very same objects are handed to every adapter, which is what guarantees two
 * providers install identical instructions.
 */
export interface AdapterContext {
  /** Absolute path of the project being installed into. */
  readonly projectDir: string;
  /** Resolved skills, in resolution order. */
  readonly skills: readonly SkillDefinition[];
  /** Resolved MCP servers, in resolution order. */
  readonly mcpServers?: readonly McpServerDefinition[];
  /** Resolved hooks, in resolution order. */
  readonly hooks?: readonly HookDefinition[];
  readonly agents?: readonly AgentDefinition[];
}

/** A file an adapter wants to exist, described without touching the filesystem. */
export interface PlannedFile {
  /**
   * Path segments below the project root. Segments rather than a string so a
   * separator is never hand-written: the planner joins them with `node:path`
   * and the result is correct on Windows too.
   */
  readonly segments: readonly string[];
  readonly content: string;
  /** The skill this file was generated from. */
  readonly skill: string;
}
export interface PlannedAgentFile {
  readonly segments: readonly string[];
  readonly content: string;
  readonly agent: string;
}

export interface PlannedMcpConfig {
  readonly segments: readonly string[];
  readonly content: string;
  readonly servers: readonly string[];
  /**
   * Whether the rendered document has nothing left in it.
   *
   * Only the code that knows the file format can answer this, and it is what
   * lets an uninstall remove a config file Agentyx created outright instead of
   * leaving an empty shell behind.
   */
  readonly empty: boolean;
}

/**
 * The state of a provider's MCP config before Agentyx touches it, plus the
 * server keys to take back out of it.
 *
 * These files are shared with the user, so Agentyx merges into them rather than
 * owning them: `remove` names only keys Agentyx itself added, and everything
 * else in the document is carried through untouched.
 */
export interface ExistingMcpConfig {
  readonly content: string | undefined;
  readonly remove: readonly string[];
}

export interface PlannedHookConfig {
  readonly segments: readonly string[];
  readonly content: string;
  readonly hooks: readonly string[];
  /** Set when Agentyx deliberately plans nothing; the reason. The planner emits no operation. */
  readonly skipped?: string;
  /**
   * Whether the rendered document has nothing left in it.
   *
   * Only the code that knows the file format can answer this, and it is what
   * lets an uninstall remove a config file Agentyx created outright instead of
   * leaving an empty shell behind.
   */
  readonly empty: boolean;
}

/**
 * The state of a provider's hook config before Agentyx touches it, plus the
 * hook names to take back out of it.
 *
 * These files are shared with the user, so Agentyx merges into them rather than
 * owning them: `remove` names only hooks Agentyx itself added, and everything
 * else in the document is carried through untouched.
 */
export interface ExistingHookConfig {
  readonly content: string | undefined;
  readonly remove: readonly string[];
  /** Content of {@link AgentAdapter.hooksSiblingConfigPath}, when the adapter names one. */
  readonly sibling?: string | undefined;
}

/** How far Agentyx can vouch for a provider's hook installation, without changing anything. */
export interface HookInstallStatus {
  /** Project-relative path of the hook configuration. */
  readonly path: string;
  /** Agentyx-owned entries are present in it. */
  readonly configured: boolean;
  /**
   * `review-may-be-required`: the provider asks the user to review and trust project hooks, and
   * Agentyx cannot verify that it happened. `unknown`: nothing is known either way.
   */
  readonly trust: "review-may-be-required" | "unknown";
  /** Why the hooks are not configured, when Agentyx deliberately left them out. */
  readonly note?: string;
}

/** What Agentyx can say about a provider in a project without changing anything. */
export interface AdapterDetection {
  readonly target: string;
  /** Absolute directory Agentyx owns for this provider's skills. */
  readonly skillsPath: string;
  /** Whether that directory already exists. */
  readonly present: boolean;
  /**
   * Whether the provider itself appears to be used in this project.
   *
   * Distinct from `present`: the skills directory is shared between providers
   * — Codex and Kimi Code both read `.agents/skills` — so its existence says
   * nothing about *which* agent the project uses. This looks at a marker the
   * provider owns alone, which is what makes it usable as a default.
   */
  readonly configured: boolean;
}

/**
 * Translates a resolved Agentyx environment into one provider's filesystem
 * layout.
 *
 * The contract is deliberately narrow, and split so that provider knowledge
 * stays free of I/O:
 *
 * - `planFiles` is **pure** — resolved skills in, desired files out. It reads
 *   nothing and writes nothing, so an adapter is testable without a disk.
 * - Comparing those files against what is already installed, and writing them,
 *   is shared machinery (`planTargetInstall`, `applyInstallPlan`) that every
 *   adapter reuses instead of reimplementing.
 *
 * There is no permission method here on purpose; skills, MCP servers and hooks
 * are what Agentyx installs today, each behind its own capability flag so a
 * provider that supports only some of them never has to fake the rest.
 */
export interface AgentAdapter {
  /** Stable identifier, matching the value used in `targets`. */
  readonly id: string;
  /** Human-readable provider name, for CLI output. */
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  /** Official provider documentation that explains the locations/formats this adapter uses. */
  readonly references?: readonly string[];
  /** The absolute directory Agentyx owns for this provider in `projectDir`. */
  skillsPath(projectDir: string): string;
  /** The absolute project-local agent directory, when supported. */
  agentsPath?(projectDir: string): string;
  /** Reads the filesystem to report where and whether the provider is set up. Never writes. */
  detect(projectDir: string): Promise<AdapterDetection>;
  /** Maps resolved skills to the files this provider expects. No filesystem access. */
  planFiles(context: AdapterContext): readonly PlannedFile[];
  planAgents?(context: AdapterContext): readonly PlannedAgentFile[];
  /** Path to the project-local MCP config, when supported. */
  mcpConfigPath?(projectDir: string): string;
  /** Merges resolved MCP servers into existing provider config content, minus any removals. */
  planMcpConfig?(context: AdapterContext, existing: ExistingMcpConfig): PlannedMcpConfig;
  /** Path to the project-local hook config, when supported. */
  hooksConfigPath?(projectDir: string): string;
  /**
   * A second file the provider also reads hooks from, passed to `planHookConfig` as `sibling`. Lets
   * an adapter avoid defining the same hooks in two places.
   */
  hooksSiblingConfigPath?(projectDir: string): string;
  /** Reports hook installation state and trust. Reads only; never writes. */
  inspectHooks?(projectDir: string): Promise<HookInstallStatus>;
  /** Reduces one provider hook payload to metadata Agentyx may keep, or nothing. */
  observeHook?: HookPayloadNormalizer;
  /** Merges resolved hooks into existing provider config content, minus any removals. */
  planHookConfig?(context: AdapterContext, existing: ExistingHookConfig): PlannedHookConfig;
}
