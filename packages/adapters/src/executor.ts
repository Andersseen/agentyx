import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertInside } from "./path.js";
import type { InstallPlan } from "./plan.js";

/** What an applied plan actually did, in project-relative paths. */
export interface InstallResult {
  readonly target: string;
  readonly written: readonly string[];
  readonly unchanged: readonly string[];
}

/**
 * Writes a plan to disk.
 *
 * This is the only code in Agentyx that mutates a project, and it is deliberately
 * dull: it creates missing parent directories, writes UTF-8 text, and does
 * nothing else. There is no command execution, no network, no deletion, and no
 * file is touched that the plan did not name.
 *
 * Containment is re-checked here rather than trusted from the planner, because
 * this function accepts any `InstallPlan` — including one assembled by hand.
 * Operations already marked `unchanged` are skipped, so re-installing an
 * up-to-date project performs no writes at all.
 *
 * A dry run is simply not calling this function.
 *
 * @throws {InstallPathError} when an operation would write outside the target's directory.
 */
export async function applyInstallPlan(
  plan: InstallPlan,
  applied = new Set<string>(),
): Promise<InstallResult> {
  assertInside(plan.skillsPath, plan.projectDir);

  const written: string[] = [];
  const unchanged: string[] = [];

  for (const operation of plan.operations) {
    assertInside(operation.path, plan.skillsPath);
    const key = operationKey(operation.path, operation.content);

    if (operation.status === "unchanged" || applied.has(key)) {
      unchanged.push(operation.relativePath);
      continue;
    }

    await mkdir(dirname(operation.path), { recursive: true });
    await writeFile(operation.path, operation.content, "utf8");
    applied.add(key);
    written.push(operation.relativePath);
  }

  for (const operation of plan.mcpOperations) {
    assertInside(operation.path, plan.projectDir);
    const key = operationKey(operation.path, operation.content);

    if (operation.status === "unchanged" || applied.has(key)) {
      unchanged.push(operation.relativePath);
      continue;
    }

    await mkdir(dirname(operation.path), { recursive: true });
    await writeFile(operation.path, operation.content, "utf8");
    applied.add(key);
    written.push(operation.relativePath);
  }

  return { target: plan.target, written, unchanged };
}

/** Applies plans one after another, in order, and reports each result. */
export async function applyInstallPlans(plans: readonly InstallPlan[]): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  const applied = new Set<string>();

  for (const plan of plans) {
    results.push(await applyInstallPlan(plan, applied));
  }

  return results;
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
