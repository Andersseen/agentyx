import type { McpServerDefinition, SkillDefinition } from "@agentyx/core";

export interface AdapterCapabilities {
  readonly skills: boolean;
  readonly mcp: {
    readonly project: boolean;
    readonly global: boolean;
    readonly transports?: readonly string[];
  };
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
 * There is no MCP, hook or permission method here on purpose; skills are the
 * only thing Agentyx installs today.
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
  /** Reads the filesystem to report where and whether the provider is set up. Never writes. */
  detect(projectDir: string): Promise<AdapterDetection>;
  /** Maps resolved skills to the files this provider expects. No filesystem access. */
  planFiles(context: AdapterContext): readonly PlannedFile[];
  /** Path to the project-local MCP config, when supported. */
  mcpConfigPath?(projectDir: string): string;
  /** Merges resolved MCP servers into existing provider config content, minus any removals. */
  planMcpConfig?(context: AdapterContext, existing: ExistingMcpConfig): PlannedMcpConfig;
}
