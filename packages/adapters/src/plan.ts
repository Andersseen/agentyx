/**
 * What a planned write would do to the destination:
 *
 * - `create` — nothing is there yet;
 * - `update` — an Agnox-managed file is there with different content;
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
}

/** Everything Agnox would change for one target, computed without writing anything. */
export interface InstallPlan {
  /** The target id, matching the adapter that produced the plan. */
  readonly target: string;
  /** Human-readable provider name. */
  readonly name: string;
  /** Absolute project root. */
  readonly projectDir: string;
  /** Absolute directory Agnox owns for this target. Every operation lands inside it. */
  readonly skillsPath: string;
  /** `skillsPath` relative to the project root, with `/` separators. */
  readonly relativeSkillsPath: string;
  /** Operations in skill resolution order. */
  readonly operations: readonly InstallOperation[];
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

  for (const plan of plans) {
    for (const operation of plan.operations) {
      summary[operation.status] += 1;
    }
  }

  return summary;
}
