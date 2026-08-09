/**
 * What a planned write would do to the destination:
 *
 * - `create` — nothing is there yet;
 * - `update` — an Agentyx-managed file is there with different content;
 * - `unchanged` — the file is already byte-identical, so the executor skips it.
 */
export type InstallOperationStatus = "create" | "update" | "unchanged";

/**
 * One planned filesystem change.
 *
 * `write-file` is the only operation type. Missing parent directories are
 * created by the executor, which removes the need for a `create-directory`
 * operation, and there is deliberately no operation that runs a command.
 */
export interface InstallOperation {
  readonly type: "write-file";
  readonly status: InstallOperationStatus;
  /** Absolute destination, in the platform's own path format. */
  readonly path: string;
  /**
   * The same destination relative to the project root, always with `/`
   * separators. This is what output and tests use, so a plan reads the same on
   * every machine.
   */
  readonly relativePath: string;
  /** The skill this file was generated from — the attribution a future manifest would record. */
  readonly skill: string;
  readonly content: string;
  /** Targets that are satisfied by this exact physical write. */
  readonly usedBy: readonly string[];
}

export interface McpInstallOperation {
  readonly type: "configure-mcp";
  readonly status: InstallOperationStatus;
  readonly path: string;
  readonly relativePath: string;
  readonly servers: readonly string[];
  readonly content: string;
  /** Targets that are satisfied by this exact physical write. */
  readonly usedBy: readonly string[];
}

/** Everything Agentyx would change for one target, computed without writing anything. */
export interface InstallPlan {
  /** The target id, matching the adapter that produced the plan. */
  readonly target: string;
  /** Human-readable provider name. */
  readonly name: string;
  /** Absolute project root. */
  readonly projectDir: string;
  /** Absolute directory Agentyx owns for this target. Every operation lands inside it. */
  readonly skillsPath: string;
  /** `skillsPath` relative to the project root, with `/` separators. */
  readonly relativeSkillsPath: string;
  /** Operations in skill resolution order. */
  readonly operations: readonly InstallOperation[];
  /** Project-local MCP configuration operation, when the target supports it. */
  readonly mcpOperations: readonly McpInstallOperation[];
  /** MCP servers that could not be installed into the requested project scope. */
  readonly unsupportedMcp: readonly string[];
}

/** How many operations of each status a set of plans holds. */
export interface InstallPlanSummary {
  readonly create: number;
  readonly update: number;
  readonly unchanged: number;
}

/** Counts operations by status, across one or more plans. */
export function summarizeInstallPlans(plans: readonly InstallPlan[]): InstallPlanSummary {
  const summary = { create: 0, update: 0, unchanged: 0 };
  const seen = new Set<string>();

  for (const plan of plans) {
    for (const operation of plan.operations) {
      const key = operationKey(operation.path, operation.content);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      summary[operation.status] += 1;
    }

    for (const operation of plan.mcpOperations) {
      const key = operationKey(operation.path, operation.content);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      summary[operation.status] += 1;
    }
  }

  return summary;
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
