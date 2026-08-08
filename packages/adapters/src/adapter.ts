import type { SkillDefinition } from "@agnox/core";

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

/** What Agnox can say about a provider in a project without changing anything. */
export interface AdapterDetection {
  readonly target: string;
  /** Absolute directory Agnox owns for this provider's skills. */
  readonly skillsPath: string;
  /** Whether that directory already exists. */
  readonly present: boolean;
}

/**
 * Translates a resolved Agnox environment into one provider's filesystem
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
 * only thing Agnox installs today.
 */
export interface AgentAdapter {
  /** Stable identifier, matching the value used in `targets`. */
  readonly id: string;
  /** Human-readable provider name, for CLI output. */
  readonly name: string;
  /** The absolute directory Agnox owns for this provider in `projectDir`. */
  skillsPath(projectDir: string): string;
  /** Reads the filesystem to report where and whether the provider is set up. Never writes. */
  detect(projectDir: string): Promise<AdapterDetection>;
  /** Maps resolved skills to the files this provider expects. No filesystem access. */
  planFiles(context: AdapterContext): readonly PlannedFile[];
}
