/**
 * What a planned write would do to the destination:
 *
 * - `create` — nothing is there yet;
 * - `update` — the install manifest says Agentyx wrote what is there, so it may
 *   be replaced;
 * - `unchanged` — the file is already byte-identical, so the executor skips it;
 * - `conflict` — something else is there. Either the file predates Agentyx, or a
 *   file Agentyx wrote has been edited since. The executor never writes over
 *   this; `force` is what turns it into an `update`.
 */
export type InstallOperationStatus = "create" | "update" | "unchanged" | "conflict";

/**
 * What a planned removal would do:
 *
 * - `delete` — the manifest records this file, it is still byte-for-byte what
 *   Agentyx wrote, and nothing needs it any more;
 * - `conflict` — it has been edited since Agentyx wrote it, so it is left alone;
 * - `unchanged` — it is already gone.
 */
export type DeleteOperationStatus = "delete" | "conflict" | "unchanged";

/**
 * One planned filesystem change.
 *
 * Missing parent directories are created by the executor, which removes the
 * need for a `create-directory` operation, and there is deliberately no
 * operation that runs a command.
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
  /** The skill this file was generated from, and the attribution the manifest records. */
  readonly skill: string;
  readonly content: string;
  /** Targets that are satisfied by this exact physical write. */
  readonly usedBy: readonly string[];
}

/**
 * One planned removal of a file Agentyx previously wrote.
 *
 * A removal is only ever proposed for a path the install manifest records, so
 * Agentyx cannot delete a file it did not create — and only when no target left
 * in the project still wants it.
 */
export interface DeleteOperation {
  readonly type: "delete-file";
  readonly status: DeleteOperationStatus;
  /**
   * What is being removed. A `skill` file is Agentyx's alone; an `mcp` file is
   * only ever removed when Agentyx created it and nothing is left in it.
   */
  readonly kind: "skill" | "mcp";
  readonly path: string;
  readonly relativePath: string;
  /** The skill the file was generated from, for `skill` removals. */
  readonly skill: string | undefined;
  /** Targets the manifest recorded for this file. */
  readonly usedBy: readonly string[];
}

export interface McpInstallOperation {
  readonly type: "configure-mcp";
  readonly status: InstallOperationStatus;
  readonly path: string;
  readonly relativePath: string;
  readonly servers: readonly string[];
  readonly content: string;
  /**
   * Whether this file did not exist before the plan was made. Recorded in the
   * manifest, because removing a shared config file is only ever safe for one
   * Agentyx created.
   */
  readonly created: boolean;
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
  /** Managed files that are no longer wanted. Empty unless pruning was asked for. */
  readonly deletions: readonly DeleteOperation[];
  /** MCP servers that could not be installed into the requested project scope. */
  readonly unsupportedMcp: readonly string[];
}

/** How many operations of each status a set of plans holds. */
export interface InstallPlanSummary {
  readonly create: number;
  readonly update: number;
  readonly unchanged: number;
  readonly conflict: number;
  readonly delete: number;
}

/** Counts operations by status, across one or more plans. */
export function summarizeInstallPlans(plans: readonly InstallPlan[]): InstallPlanSummary {
  const summary = { create: 0, update: 0, unchanged: 0, conflict: 0, delete: 0 };
  const seen = new Set<string>();

  for (const plan of plans) {
    for (const operation of [...plan.operations, ...plan.mcpOperations]) {
      const key = operationKey(operation.path, operation.content);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      summary[operation.status] += 1;
    }

    for (const operation of plan.deletions) {
      const key = operationKey(operation.path, operation.type);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      summary[operation.status] += 1;
    }
  }

  return summary;
}

/** Every write or removal a set of plans refuses to perform because it does not own the file. */
export function collectInstallConflicts(plans: readonly InstallPlan[]): readonly string[] {
  const conflicts = new Set<string>();

  for (const plan of plans) {
    for (const operation of [...plan.operations, ...plan.deletions]) {
      if (operation.status === "conflict") {
        conflicts.add(operation.relativePath);
      }
    }
  }

  return [...conflicts].sort();
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
