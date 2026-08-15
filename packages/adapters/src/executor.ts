import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  agentyxManifestPath,
  emptyInstallManifest,
  formatInstallManifest,
  hashContent,
  type InstallManifest,
  type InstallManifestEntry,
  manifestEntriesByPath,
} from "@agentyx/core";
import { assertInside } from "./path.js";
import type { InstallPlan } from "./plan.js";

/** What an applied plan actually did, in project-relative paths. */
export interface InstallResult {
  readonly target: string;
  readonly written: readonly string[];
  readonly unchanged: readonly string[];
  /** Managed files removed because nothing wants them any more. */
  readonly deleted: readonly string[];
  /** Files left untouched because Agentyx does not own them. */
  readonly conflicts: readonly string[];
}

export interface ApplyInstallOptions {
  /**
   * The manifest as it stood before this run.
   *
   * Entries belonging to targets that are not part of this run are carried
   * through unchanged, so installing one provider never makes Agentyx forget
   * what it wrote for another.
   */
  readonly manifest?: InstallManifest;
}

/**
 * Writes one target's plan to disk.
 *
 * This and `applyInstallPlans` are the only code in Agentyx that mutate a
 * project, and they are deliberately dull: create missing parent directories,
 * write UTF-8 text, remove files the manifest already recorded, and nothing
 * else. There is no command execution, no network, and no file is touched that
 * the plan did not name.
 *
 * Containment is re-checked here rather than trusted from the planner, because
 * this function accepts any `InstallPlan` — including one assembled by hand.
 * Operations already marked `unchanged` are skipped, so re-installing an
 * up-to-date project performs no writes at all, and `conflict` operations are
 * skipped too: a destination Agentyx does not own is never written over and
 * never deleted.
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
  const deleted: string[] = [];
  const conflicts: string[] = [];

  for (const operation of plan.operations) {
    assertInside(operation.path, plan.skillsPath);

    if (operation.status === "conflict") {
      conflicts.push(operation.relativePath);
      continue;
    }

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

    if (operation.status === "conflict") {
      conflicts.push(operation.relativePath);
      continue;
    }

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

  for (const operation of plan.deletions) {
    assertInside(operation.path, operation.kind === "skill" ? plan.skillsPath : plan.projectDir);

    if (operation.status === "conflict") {
      conflicts.push(operation.relativePath);
      continue;
    }

    const key = operationKey(operation.path, operation.type);

    if (operation.status === "unchanged" || applied.has(key)) {
      continue;
    }

    await rm(operation.path, { force: true });
    await removeEmptyParents(operation.path, plan.projectDir);
    applied.add(key);
    deleted.push(operation.relativePath);
  }

  return { target: plan.target, written, unchanged, deleted, conflicts };
}

/**
 * Applies plans one after another, in order, and records the result.
 *
 * Only this function updates `.agentyx.lock.json`, because only the full set of
 * plans knows which targets a shared file such as `.agents/skills/planning/SKILL.md`
 * now belongs to. When nothing is left to record — after an uninstall — the
 * manifest file is removed rather than left behind empty.
 */
export async function applyInstallPlans(
  plans: readonly InstallPlan[],
  options: ApplyInstallOptions = {},
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  const applied = new Set<string>();

  for (const plan of plans) {
    results.push(await applyInstallPlan(plan, applied));
  }

  const projectDir = plans[0]?.projectDir;

  if (projectDir !== undefined) {
    const manifest = nextManifest(options.manifest ?? emptyInstallManifest(), plans);
    const path = agentyxManifestPath(projectDir);

    if (manifest.entries.length > 0) {
      await writeFile(path, formatInstallManifest(manifest), "utf8");
    } else {
      await rm(path, { force: true });
    }
  }

  return results;
}

/**
 * The manifest as it stands after a run.
 *
 * Three groups make it up: entries this run rewrote, entries it removed (which
 * simply disappear), and everything else, which is carried through untouched so
 * that files left on disk without `prune` stay attributed to Agentyx.
 *
 * A `conflict` contributes nothing — Agentyx wrote nothing, so it claims
 * nothing. A removal that turned out to be a conflict drops its entry instead:
 * the file is now the user's, and Agentyx stops speaking for it.
 */
function nextManifest(previous: InstallManifest, plans: readonly InstallPlan[]): InstallManifest {
  const plannedTargets = new Set(plans.map((plan) => plan.target));
  const previousByPath = manifestEntriesByPath(previous);
  const removed = new Set<string>();
  const rewritten = new Map<string, InstallManifestEntry>();

  for (const plan of plans) {
    for (const operation of plan.deletions) {
      removed.add(operation.relativePath);
    }

    for (const operation of plan.operations) {
      if (operation.status === "conflict") {
        continue;
      }

      rewritten.set(operation.relativePath, {
        kind: "skill",
        path: operation.relativePath,
        skill: operation.skill,
        targets: retainedTargets(
          operation.usedBy,
          previousByPath,
          operation.relativePath,
          plannedTargets,
        ),
        hash: hashContent(operation.content),
      });
    }

    for (const operation of plan.mcpOperations) {
      if (operation.status === "conflict") {
        continue;
      }

      const previousEntry = previousByPath.get(operation.relativePath);

      rewritten.set(operation.relativePath, {
        kind: "mcp",
        path: operation.relativePath,
        servers: [...operation.servers],
        targets: retainedTargets(
          operation.usedBy,
          previousByPath,
          operation.relativePath,
          plannedTargets,
        ),
        hash: hashContent(operation.content),
        created: previousEntry?.kind === "mcp" ? previousEntry.created : operation.created,
      });
    }
  }

  return {
    version: previous.version,
    entries: [
      ...previous.entries.filter((entry) => !removed.has(entry.path) && !rewritten.has(entry.path)),
      ...rewritten.values(),
    ],
  };
}

/** Targets this run wrote for, plus any target outside the run that the entry already served. */
function retainedTargets(
  usedBy: readonly string[],
  previousByPath: ReadonlyMap<string, InstallManifestEntry>,
  path: string,
  plannedTargets: ReadonlySet<string>,
): string[] {
  const carried = (previousByPath.get(path)?.targets ?? []).filter(
    (target) => !plannedTargets.has(target),
  );

  return [...new Set([...usedBy, ...carried])];
}

/**
 * Clears away the directories a deleted file leaves behind, as far up as they
 * are empty.
 *
 * `rmdir` without `recursive` is the whole safety argument: a directory that
 * still holds anything — another skill, a file the user put there — fails with
 * `ENOTEMPTY`, which both leaves it alone and stops the walk. The project root
 * is never a candidate, so this can only ever remove directories Agentyx filled
 * in the first place, and an uninstall leaves no empty shells behind.
 */
async function removeEmptyParents(path: string, projectDir: string): Promise<void> {
  let directory = dirname(path);

  while (isInside(directory, projectDir)) {
    try {
      await rmdir(directory);
    } catch {
      return;
    }

    directory = dirname(directory);
  }
}

function isInside(path: string, root: string): boolean {
  try {
    assertInside(path, root);

    return true;
  } catch {
    return false;
  }
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
