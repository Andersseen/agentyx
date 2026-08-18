import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  emptyInstallManifest,
  hashContent,
  type InstallManifest,
  type InstallManifestEntry,
  type McpManifestEntry,
  type McpServerDefinition,
  manifestEntriesByPath,
  type SkillDefinition,
  type SkillManifestEntry,
} from "@agentyx/core";
import type { AgentAdapter, PlannedFile } from "./adapter.js";
import { builtInAdapterRegistry } from "./built-in.js";
import { MissingInstallTargetsError, SharedInstallConflictError } from "./errors.js";
import { assertInside, assertInsideRealPath, toDisplayPath } from "./path.js";
import type {
  DeleteOperation,
  DeleteOperationStatus,
  InstallOperation,
  InstallOperationStatus,
  InstallPlan,
  McpInstallOperation,
} from "./plan.js";
import type { AdapterRegistry } from "./registry.js";

export interface PlanTargetInstallInput {
  /** Target id, as it appears in `targets`. */
  readonly target: string;
  readonly projectDir: string;
  /** Resolved skills, in resolution order. */
  readonly skills: readonly SkillDefinition[];
  /** Resolved MCP servers, in resolution order. */
  readonly mcpServers?: readonly McpServerDefinition[];
  /**
   * What Agentyx installed last time. Without it every existing file looks like
   * someone else's, which is the safe default but makes reinstalling impossible.
   */
  readonly manifest?: InstallManifest;
  /** Plan removals for managed files nothing wants any more. */
  readonly prune?: boolean;
  /** Overwrite files Agentyx does not own instead of reporting them as conflicts. */
  readonly force?: boolean;
  /**
   * Every target covered by the surrounding run.
   *
   * A file recorded for two providers — the `.agents/skills` directory Codex and
   * Kimi share — may only be removed when both are part of the run. Defaults to
   * this target alone, so planning one target in isolation never deletes what
   * another still relies on.
   */
  readonly plannedTargets?: readonly string[];
  readonly registry?: AdapterRegistry;
}

export interface PlanInstallInput
  extends Omit<PlanTargetInstallInput, "target" | "plannedTargets"> {
  readonly targets: readonly string[];
}

/**
 * Works out everything one target needs, and changes nothing.
 *
 * The adapter contributes the desired files; comparing them with what is on
 * disk happens here, once, for every provider. Planning reads the destination
 * files to classify each operation, but it never creates, moves, deletes or
 * writes anything — a plan is safe to discard.
 *
 * Classification is where ownership is decided. A destination Agentyx has no
 * record of writing is a `conflict`, never an `update`, so a skill directory
 * shared with hand-written skills is safe by default.
 *
 * @throws {UnknownAdapterError} when no adapter is registered for the target.
 * @throws {InstallPathError} when the adapter asks for a file outside the directory it owns.
 */
export async function planTargetInstall(input: PlanTargetInstallInput): Promise<InstallPlan> {
  const adapter = (input.registry ?? builtInAdapterRegistry).get(input.target);
  const projectDir = resolve(input.projectDir);
  const skillsPath = adapter.skillsPath(projectDir);

  assertInside(skillsPath, projectDir);
  await assertInsideRealPath(skillsPath, projectDir);

  const manifest = input.manifest ?? emptyInstallManifest();
  const recorded = manifestEntriesByPath(manifest);
  const mcpServers = input.mcpServers ?? [];
  const context = { projectDir, skills: input.skills, mcpServers };
  const files = adapter.planFiles(context);
  const operations = await Promise.all(
    files.map((file) => planFile(file, projectDir, skillsPath, adapter.id, recorded, input.force)),
  );
  const mcp = await planMcp({
    adapter,
    context,
    projectDir,
    recorded,
    prune: input.prune === true,
  });
  const deletions = input.prune
    ? [
        ...(await planSkillDeletions({
          manifest,
          adapter,
          projectDir,
          desired: new Set(operations.map((operation) => operation.relativePath)),
          plannedTargets: new Set(input.plannedTargets ?? [input.target]),
        })),
        ...mcp.deletions,
      ]
    : [];

  return {
    target: adapter.id,
    name: adapter.name,
    projectDir,
    skillsPath,
    relativeSkillsPath: toDisplayPath(projectDir, skillsPath),
    operations,
    mcpOperations: mcp.operations,
    deletions,
    unsupportedMcp:
      mcpServers.length > 0 && !adapter.capabilities.mcp.project
        ? mcpServers.map((server) => server.name)
        : [],
  };
}

/**
 * Plans one installation per target, from a single set of resolved skills.
 *
 * Every target is handed the *same* `SkillDefinition` objects, which is the
 * point: two providers can only ever receive identical instructions, and the
 * one thing that differs between their plans is where the files go. Repeated
 * targets collapse to one plan, and the results follow the requested order.
 *
 * @throws {MissingInstallTargetsError} when no target is supplied.
 */
export async function planInstall(input: PlanInstallInput): Promise<InstallPlan[]> {
  const targets = [...new Set(input.targets)];

  if (targets.length === 0) {
    throw new MissingInstallTargetsError();
  }

  const plans = await Promise.all(
    targets.map((target) => planTargetInstall({ ...input, target, plannedTargets: targets })),
  );

  return annotateSharedOperations(plans);
}

/**
 * Plans the removal of everything the manifest records for the given targets.
 *
 * This is `planInstall` with nothing desired: the same ownership checks apply,
 * so a managed file that has been edited since Agentyx wrote it is reported as a
 * conflict and left where it is.
 *
 * @throws {MissingInstallTargetsError} when no target is supplied.
 */
export async function planUninstall(
  input: Omit<PlanInstallInput, "skills" | "mcpServers" | "prune">,
): Promise<InstallPlan[]> {
  return planInstall({ ...input, skills: [], mcpServers: [], prune: true });
}

async function planFile(
  file: PlannedFile,
  projectDir: string,
  skillsPath: string,
  target: string,
  recorded: ReadonlyMap<string, InstallManifestEntry>,
  force: boolean | undefined,
): Promise<InstallOperation> {
  const path = resolve(projectDir, join(...file.segments));

  assertInside(path, skillsPath);
  await assertInsideRealPath(path, skillsPath);

  const relativePath = toDisplayPath(projectDir, path);
  const entry = recorded.get(relativePath);
  const status = await statusOf(
    path,
    file.content,
    entry?.kind === "skill" ? entry.hash : undefined,
    force,
  );

  return {
    type: "write-file",
    status,
    path,
    relativePath,
    skill: file.skill,
    content: file.content,
    usedBy: [target],
  };
}

interface PlanMcpInput {
  readonly adapter: AgentAdapter;
  readonly context: {
    readonly projectDir: string;
    readonly skills: readonly SkillDefinition[];
    readonly mcpServers: readonly McpServerDefinition[];
  };
  readonly projectDir: string;
  readonly recorded: ReadonlyMap<string, InstallManifestEntry>;
  readonly prune: boolean;
}

/**
 * Plans the provider's MCP configuration.
 *
 * These files belong to the user, not to Agentyx: Agentyx merges its own server
 * entries into whatever is there and carries everything else through, so they
 * are deliberately exempt from the ownership check that guards skill files —
 * hand-editing `.mcp.json` is expected, not a conflict. Pruning removes only the
 * keys the manifest says Agentyx added, and the file itself is removed only when
 * Agentyx created it and nothing is left in it.
 */
async function planMcp(input: PlanMcpInput): Promise<{
  readonly operations: readonly McpInstallOperation[];
  readonly deletions: readonly DeleteOperation[];
}> {
  const { adapter, context, projectDir, recorded, prune } = input;

  if (!adapter.capabilities.mcp.project || adapter.planMcpConfig === undefined) {
    return { operations: [], deletions: [] };
  }

  const configPath = adapter.mcpConfigPath?.(projectDir);

  if (configPath === undefined) {
    return { operations: [], deletions: [] };
  }

  assertInside(configPath, projectDir);
  await assertInsideRealPath(configPath, projectDir);

  const relativePath = toDisplayPath(projectDir, configPath);
  const entry = recorded.get(relativePath);
  const recordedEntry: McpManifestEntry | undefined = entry?.kind === "mcp" ? entry : undefined;
  const desired = new Set(context.mcpServers.map((server) => server.name));
  const remove = prune
    ? (recordedEntry?.servers ?? []).filter((name) => !desired.has(name))
    : ([] as readonly string[]);

  if (context.mcpServers.length === 0 && remove.length === 0) {
    return { operations: [], deletions: [] };
  }

  const existingContent = await readExistingMcpConfig(configPath);
  const planned = adapter.planMcpConfig(context, { content: existingContent, remove });

  if (planned.empty && recordedEntry?.created === true) {
    return {
      operations: [],
      deletions: [
        {
          type: "delete-file",
          status: await deletionStatusOf(configPath, recordedEntry.hash),
          kind: "mcp",
          path: configPath,
          relativePath,
          skill: undefined,
          usedBy: recordedEntry.targets,
        },
      ],
    };
  }

  const path = resolve(projectDir, join(...planned.segments));

  assertInside(path, projectDir);
  await assertInsideRealPath(path, projectDir);

  return {
    operations: [
      {
        type: "configure-mcp",
        status: await statusOf(path, planned.content, undefined, true),
        path,
        relativePath: toDisplayPath(projectDir, path),
        servers: planned.servers,
        content: planned.content,
        created: existingContent === undefined,
        usedBy: [adapter.id],
      },
    ],
    deletions: [],
  };
}

interface PlanSkillDeletionsInput {
  readonly manifest: InstallManifest;
  readonly adapter: AgentAdapter;
  readonly projectDir: string;
  /** Project-relative paths this target still wants. */
  readonly desired: ReadonlySet<string>;
  readonly plannedTargets: ReadonlySet<string>;
}

/**
 * Proposes removals for managed skill files nothing wants any more.
 *
 * Three conditions have to hold before a path is even considered: the manifest
 * records it, this target is one of the targets it was written for, and every
 * other target it was written for is part of this run. The last one is what
 * stops `--target codex` from deleting the files Kimi shares with it in
 * `.agents/skills`.
 */
async function planSkillDeletions(
  input: PlanSkillDeletionsInput,
): Promise<readonly DeleteOperation[]> {
  const { manifest, adapter, projectDir, desired, plannedTargets } = input;
  const candidates = manifest.entries.filter(
    (entry): entry is SkillManifestEntry =>
      entry.kind === "skill" &&
      entry.targets.includes(adapter.id) &&
      !desired.has(entry.path) &&
      entry.targets.every((target) => plannedTargets.has(target)),
  );

  return Promise.all(
    candidates.map(async (entry) => {
      const path = resolve(projectDir, ...entry.path.split("/"));

      assertInside(path, adapter.skillsPath(projectDir));
      await assertInsideRealPath(path, adapter.skillsPath(projectDir));

      return {
        type: "delete-file" as const,
        status: await deletionStatusOf(path, entry.hash),
        kind: "skill" as const,
        path,
        relativePath: entry.path,
        skill: entry.skill,
        usedBy: entry.targets,
      };
    }),
  );
}

async function readExistingMcpConfig(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw cause;
  }
}

/**
 * Decides what writing `content` to `path` would mean.
 *
 * `recordedHash` is the digest the manifest holds for this path. When it is
 * absent, or does not match what is on disk, the file is someone else's and the
 * result is a `conflict` — the single rule that covers both a pre-existing file
 * and a managed file edited by hand.
 */
async function statusOf(
  path: string,
  content: string,
  recordedHash: string | undefined,
  force: boolean | undefined,
): Promise<InstallOperationStatus> {
  let installed: string;

  try {
    installed = await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return "create";
    }

    throw cause;
  }

  if (installed === content) {
    return "unchanged";
  }

  if (force === true || (recordedHash !== undefined && hashContent(installed) === recordedHash)) {
    return "update";
  }

  return "conflict";
}

/** A managed file may only be deleted while it still holds exactly what Agentyx wrote. */
async function deletionStatusOf(
  path: string,
  recordedHash: string,
): Promise<DeleteOperationStatus> {
  let installed: string;

  try {
    installed = await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return "unchanged";
    }

    throw cause;
  }

  return hashContent(installed) === recordedHash ? "delete" : "conflict";
}

function annotateSharedOperations(plans: readonly InstallPlan[]): InstallPlan[] {
  const byPath = new Map<string, { readonly content: string; readonly targets: Set<string> }>();

  for (const plan of plans) {
    for (const operation of [...plan.operations, ...plan.mcpOperations]) {
      const found = byPath.get(operation.path);

      if (found !== undefined && found.content !== operation.content) {
        throw new SharedInstallConflictError(operation.relativePath, [
          ...found.targets,
          plan.target,
        ]);
      }

      if (found === undefined) {
        byPath.set(operation.path, {
          content: operation.content,
          targets: new Set([plan.target]),
        });
        continue;
      }

      found.targets.add(plan.target);
    }
  }

  const usedBy = new Map<string, readonly string[]>();
  for (const [path, value] of byPath) {
    usedBy.set(operationKey(path, value.content), [...value.targets]);
  }

  return plans.map((plan) => ({
    ...plan,
    operations: plan.operations.map((operation) => ({
      ...operation,
      usedBy: usedBy.get(operationKey(operation.path, operation.content)) ?? [plan.target],
    })),
    mcpOperations: plan.mcpOperations.map((operation) => ({
      ...operation,
      usedBy: usedBy.get(operationKey(operation.path, operation.content)) ?? [plan.target],
    })),
  }));
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
