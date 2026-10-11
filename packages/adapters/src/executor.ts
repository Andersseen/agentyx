import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
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
import { IncompleteInstallError, InstallPathError, StaleInstallPlanError } from "./errors.js";
import { assertInside, assertInsideRealPath } from "./path.js";
import type {
  DeleteOperation,
  HookInstallOperation,
  InstallOperation,
  InstallPlan,
  McpInstallOperation,
  ObservedFileState,
} from "./plan.js";

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
 * Operations already marked `unchanged` are not written, and `conflict`
 * operations are skipped: a destination Agentyx does not own is never written
 * over and never deleted.
 *
 * A plan authorizes a mutation only against the destination state it observed.
 * Every destination is revalidated before the first write, and again right
 * before it is mutated; anything that changed since planning is left alone,
 * whether or not `force` was used to plan it.
 *
 * A dry run is simply not calling this function.
 *
 * @throws {InstallPathError} when an operation would write outside the target's directory.
 * @throws {StaleInstallPlanError} when a destination changed after planning and nothing was changed.
 * @throws {IncompleteInstallError} when a failure left the plan partly applied.
 */
export async function applyInstallPlan(
  plan: InstallPlan,
  applied = new Set<string>(),
): Promise<InstallResult> {
  const state: RunState = { applied, completed: [], hooks: {} };

  return guarded([plan], state, () => runPlan(plan, state));
}

/**
 * Applies plans one after another, in order, and records the result.
 *
 * Only this function updates `.agentyx.lock.json`, because only the full set of
 * plans knows which targets a shared file such as `.agents/skills/planning/SKILL.md`
 * now belongs to. The lock is committed last, and only if every provider change
 * succeeded; when nothing is left to record — after an uninstall — the manifest
 * file is removed rather than left behind empty.
 *
 * This is not a transaction. A failure after the first change leaves the earlier
 * changes in place and the previous lock untouched, and is reported as an
 * `IncompleteInstallError`.
 */
export async function applyInstallPlans(
  plans: readonly InstallPlan[],
  options: ApplyInstallOptions = {},
): Promise<InstallResult[]> {
  return runInstallPlans(plans, options, {});
}

/** Test seams. Not exported from the package; production callers never pass them. */
export interface ExecutorHooks {
  /** Runs immediately before a mutation is revalidated, standing in for an outside actor. */
  readonly beforeMutation?: (relativePath: string) => Promise<void> | void;
}

export async function runInstallPlans(
  plans: readonly InstallPlan[],
  options: ApplyInstallOptions,
  hooks: ExecutorHooks,
): Promise<InstallResult[]> {
  const state: RunState = { applied: new Set<string>(), completed: [], hooks };

  return guarded(plans, state, async () => {
    const results: InstallResult[] = [];

    for (const plan of plans) {
      results.push(await runPlan(plan, state));
    }

    const projectDir = plans[0]?.projectDir;

    if (projectDir !== undefined) {
      const manifest = nextManifest(options.manifest ?? emptyInstallManifest(), plans);
      const path = agentyxManifestPath(projectDir);

      if (manifest.entries.length > 0) {
        await writeFileAtomic(path, formatInstallManifest(manifest));
      } else {
        await rm(path, { force: true });
      }
    }

    return results;
  });
}

interface RunState {
  /** Physical operations already satisfied during this run, so shared writes happen once. */
  readonly applied: Set<string>;
  /** Project-relative paths this run has actually written or removed. */
  readonly completed: string[];
  readonly hooks: ExecutorHooks;
}

type WriteStep = InstallOperation | McpInstallOperation | HookInstallOperation;

type Step =
  | { readonly kind: "write"; readonly operation: WriteStep; readonly root: string }
  | { readonly kind: "delete"; readonly operation: DeleteOperation; readonly root: string };

function stepsOf(plan: InstallPlan): Step[] {
  const writes = (operations: readonly WriteStep[], root: string): Step[] =>
    operations.map((operation) => ({ kind: "write", operation, root }));

  return [
    ...writes(plan.operations, plan.skillsPath),
    ...writes(plan.agentOperations, plan.agentsPath),
    ...writes(plan.mcpOperations, plan.projectDir),
    ...writes(plan.hookOperations, plan.projectDir),
    ...plan.deletions.map((operation): Step => {
      const root =
        operation.kind === "skill"
          ? plan.skillsPath
          : operation.kind === "agent"
            ? plan.agentsPath
            : plan.projectDir;

      return { kind: "delete", operation, root };
    }),
  ];
}

function stepKey(step: Step): string {
  return step.kind === "write"
    ? operationKey(step.operation.path, step.operation.content)
    : operationKey(step.operation.path, step.operation.type);
}

/** The step actually changes the filesystem if run. */
function isMutation(step: Step): boolean {
  return step.operation.status !== "conflict" && step.operation.status !== "unchanged";
}

/**
 * Checks that every destination this run relies on still matches what was
 * planned, before anything is written.
 */
async function preflight(plans: readonly InstallPlan[]): Promise<void> {
  const seen = new Set<string>();
  const stale: string[] = [];

  for (const plan of plans) {
    assertInside(plan.skillsPath, plan.projectDir);
    await assertInsideRealPath(plan.skillsPath, plan.projectDir);

    for (const step of stepsOf(plan)) {
      assertInside(step.operation.path, step.root);
      await assertInsideRealPath(step.operation.path, step.root);

      const key = stepKey(step);

      if (step.operation.status === "conflict" || seen.has(key)) {
        continue;
      }

      seen.add(key);

      if (!(await matchesObservation(step))) {
        stale.push(step.operation.relativePath);
      }
    }
  }

  if (stale.length > 0) {
    throw new StaleInstallPlanError([...new Set(stale)]);
  }
}

/**
 * Whether a step may still rely on the state the planner observed.
 *
 * A planned removal whose file has since vanished is already satisfied: the
 * outcome the plan wanted holds, and dropping the manifest entry makes no false
 * ownership claim. Everything else must match exactly, including a file that
 * disappeared under an `update` or `unchanged` write, because the manifest
 * would otherwise record content that is not on disk.
 */
async function matchesObservation(step: Step): Promise<boolean> {
  const observed = step.operation.observed;
  const current = await currentState(step.operation.path);

  if (step.kind === "delete" && current.kind === "missing") {
    return true;
  }

  if (current.kind === "missing" || observed.kind === "missing") {
    return current.kind === observed.kind;
  }

  return current.hash === observed.hash;
}

async function currentState(path: string): Promise<ObservedFileState> {
  try {
    return { kind: "file", hash: hashContent(await readFile(path, "utf8")) };
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing" };
    }

    throw cause;
  }
}

async function runPlan(plan: InstallPlan, state: RunState): Promise<InstallResult> {
  const written: string[] = [];
  const unchanged: string[] = [];
  const deleted: string[] = [];
  const conflicts: string[] = [];

  for (const step of stepsOf(plan)) {
    const { operation } = step;

    if (operation.status === "conflict") {
      conflicts.push(operation.relativePath);
      continue;
    }

    const key = stepKey(step);

    if (state.applied.has(key)) {
      // Already satisfied by this run's own earlier write or removal of the shared path.
      if (step.kind === "write") {
        unchanged.push(operation.relativePath);
      }
      continue;
    }

    await state.hooks.beforeMutation?.(operation.relativePath);

    // Containment is checked again here, right before use: the path may have become a symlink
    // since preflight. It comes first so that nothing is read or written through one.
    assertInside(operation.path, step.root);
    await assertInsideRealPath(operation.path, step.root);

    if (!(await matchesObservation(step))) {
      throw new StaleInstallPlanError([operation.relativePath]);
    }

    if (operation.status === "unchanged") {
      if (step.kind === "write") {
        unchanged.push(operation.relativePath);
      }
      continue;
    }

    if (step.kind === "write") {
      await mkdir(dirname(operation.path), { recursive: true });
      await writeFile(operation.path, step.operation.content, "utf8");
      written.push(operation.relativePath);
      state.completed.push(operation.relativePath);
    } else if ((await currentState(operation.path)).kind === "file") {
      await rm(operation.path, { force: true });
      await removeEmptyParents(operation.path, plan.projectDir);
      deleted.push(operation.relativePath);
      state.completed.push(operation.relativePath);
    }

    state.applied.add(key);
  }

  return { target: plan.target, written, unchanged, deleted, conflicts };
}

/**
 * Runs `body` after revalidating every destination, and turns a failure that
 * follows a real change into an `IncompleteInstallError`.
 *
 * A stale plan found before anything changed stays a `StaleInstallPlanError`:
 * nothing happened, so there is nothing partial to report.
 */
async function guarded<T>(
  plans: readonly InstallPlan[],
  state: RunState,
  body: () => Promise<T>,
): Promise<T> {
  await preflight(plans);

  try {
    return await body();
  } catch (error) {
    if (
      state.completed.length === 0 &&
      (error instanceof StaleInstallPlanError || error instanceof InstallPathError)
    ) {
      throw error;
    }

    throw new IncompleteInstallError(state.completed, pendingPaths(plans, state), error);
  }
}

/** Planned changes that did not happen: every create, update and delete not yet completed. */
function pendingPaths(plans: readonly InstallPlan[], state: RunState): string[] {
  const done = new Set(state.completed);
  const pending = new Set<string>();

  for (const plan of plans) {
    for (const step of stepsOf(plan)) {
      if (isMutation(step) && !done.has(step.operation.relativePath)) {
        pending.add(step.operation.relativePath);
      }
    }
  }

  return [...pending];
}

/**
 * Replaces `path` in one rename, so a failure before the rename leaves the
 * previous file exactly as it was. The temporary file sits in the same
 * directory, which keeps the rename on one filesystem.
 */
async function writeFileAtomic(path: string, content: string): Promise<void> {
  const temporary = `${path}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;

  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } catch (cause) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw cause;
  }
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

    for (const operation of plan.agentOperations) {
      if (operation.status === "conflict") continue;
      rewritten.set(operation.relativePath, {
        kind: "agent",
        path: operation.relativePath,
        agent: operation.agent ?? "",
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

    for (const operation of plan.hookOperations) {
      if (operation.status === "conflict") {
        continue;
      }

      const previousEntry = previousByPath.get(operation.relativePath);

      rewritten.set(operation.relativePath, {
        kind: "hook",
        path: operation.relativePath,
        hooks: [...operation.hooks],
        targets: retainedTargets(
          operation.usedBy,
          previousByPath,
          operation.relativePath,
          plannedTargets,
        ),
        hash: hashContent(operation.content),
        created: previousEntry?.kind === "hook" ? previousEntry.created : operation.created,
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
