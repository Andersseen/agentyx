import { hashContent, type InstallManifest, type InstallManifestEntry } from "@agentyx/core";
import { FrozenInstallError } from "./errors.js";
import type { InstallPlan } from "./plan.js";

interface DesiredResource {
  readonly kind: InstallManifestEntry["kind"];
  readonly path: string;
  readonly status: string;
  readonly content: string;
  readonly usedBy: readonly string[];
  readonly name: string | undefined;
}

/**
 * Decides whether real install plans may run under `install --frozen`, and what they restore.
 *
 * Frozen is a policy on top of the planner, not a second renderer. It accepts only resources that
 * are already satisfied and owned by the reviewed lock, plus one narrow repair: a Skill file the
 * lock owns, whose recorded hash equals the canonical content, and which is missing from disk.
 * Everything else — updates, conflicts, deletions, Agent/MCP/Hook creation, ownership the lock
 * does not record, ownership outside the desired selection — fails, because it would need either
 * a new shared-file state or a different lock.
 *
 * Pure: reads nothing and writes nothing. Returns the project-relative Skill paths to restore.
 *
 * @throws {FrozenInstallError} on the first category of violation, with project-relative paths only.
 */
export function validateFrozenPlans(
  plans: readonly InstallPlan[],
  manifest: InstallManifest,
): readonly string[] {
  const resources: DesiredResource[] = plans.flatMap((plan) => [
    ...plan.operations.map(
      (operation): DesiredResource => describe("skill", operation, operation.skill),
    ),
    ...plan.agentOperations.map(
      (operation): DesiredResource => describe("agent", operation, operation.agent),
    ),
    ...plan.mcpOperations.map(
      (operation): DesiredResource =>
        // An operation that also carries hooks is the one shared settings document, and the lock
        // records it under the `settings` kind.
        describe(operation.hooks === undefined ? "mcp" : "settings", operation, undefined),
    ),
    ...plan.hookOperations.map(
      (operation): DesiredResource => describe("hook", operation, undefined),
    ),
  ]);

  const byPath = new Map(manifest.entries.map((entry) => [entry.path, entry]));
  const stale = new Set<string>();
  const notOwned = new Set<string>();
  const changes = new Set<string>();
  const restorable = new Set<string>();

  for (const entry of manifest.entries) {
    const resource = resources.find((candidate) => candidate.path === entry.path);

    if (resource === undefined || !sameSet(entry.targets, resource.usedBy)) {
      stale.add(entry.path);
    }
  }

  for (const plan of plans) {
    for (const deletion of plan.deletions) {
      changes.add(deletion.relativePath);
    }
  }

  for (const resource of resources) {
    const entry = byPath.get(resource.path);

    if (resource.status === "conflict" || resource.status === "update") {
      changes.add(resource.path);
      continue;
    }

    if (entry === undefined || entry.kind !== resource.kind) {
      notOwned.add(resource.path);
      continue;
    }

    if (entry.hash !== hashContent(resource.content) || !sameName(entry, resource)) {
      notOwned.add(resource.path);
      continue;
    }

    if (resource.status === "create") {
      if (resource.kind === "skill") {
        restorable.add(resource.path);
      } else {
        changes.add(resource.path);
      }
    }
  }

  if (stale.size > 0) {
    throw new FrozenInstallError(
      "frozen_stale_ownership",
      `The lock owns paths outside the current selection or targets: ${list(stale)}. Review and run agentyx sync; frozen mode never edits the lock.`,
      { paths: sorted(stale) },
    );
  }

  if (notOwned.size > 0) {
    throw new FrozenInstallError(
      "frozen_restore_not_owned",
      `The lock does not record reviewed ownership of: ${list(notOwned)}. Frozen mode never claims a path; review and run agentyx sync.`,
      { paths: sorted(notOwned) },
    );
  }

  if (changes.size > 0) {
    throw new FrozenInstallError(
      "frozen_installation_change_required",
      `Frozen mode only restores missing managed Skills, but these paths need a change: ${list(changes)}. Review and run agentyx sync or agentyx install.`,
      { paths: sorted(changes) },
    );
  }

  return sorted(restorable);
}

function describe(
  kind: InstallManifestEntry["kind"],
  operation: {
    readonly status: string;
    readonly relativePath: string;
    readonly content: string;
    readonly usedBy: readonly string[];
  },
  name: string | undefined,
): DesiredResource {
  return {
    kind,
    path: operation.relativePath,
    status: operation.status,
    content: operation.content,
    usedBy: operation.usedBy,
    name,
  };
}

function sameName(entry: InstallManifestEntry, resource: DesiredResource): boolean {
  if (entry.kind === "skill") {
    return entry.skill === resource.name;
  }

  if (entry.kind === "agent") {
    return entry.agent === resource.name;
  }

  return true;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);

  return a.size === b.size && [...a].every((value) => b.has(value));
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

function list(values: Iterable<string>): string {
  return sorted(values).join(", ");
}
