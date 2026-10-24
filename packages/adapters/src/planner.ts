import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  type AgentDefinition,
  type AgentManifestEntry,
  emptyInstallManifest,
  type HookDefinition,
  type HookManifestEntry,
  hashContent,
  type InstallManifest,
  type InstallManifestEntry,
  type McpManifestEntry,
  type McpServerDefinition,
  manifestEntriesByPath,
  type SkillDefinition,
  type SkillManifestEntry,
} from "@agentyx/core";
import type { AgentAdapter, PlannedAgentFile, PlannedFile } from "./adapter.js";
import { builtInAdapterRegistry } from "./built-in.js";
import {
  InvalidAdapterConfigurationError,
  MissingInstallTargetsError,
  SharedInstallConflictError,
  UnsupportedMcpTransportError,
} from "./errors.js";
import { assertInside, assertInsideRealPath, toDisplayPath } from "./path.js";
import type {
  DeleteOperation,
  DeleteOperationStatus,
  HookInstallOperation,
  InstallOperation,
  InstallOperationStatus,
  InstallPlan,
  McpInstallOperation,
  ObservedFileState,
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
  /** Resolved hooks, in resolution order. */
  readonly hooks?: readonly HookDefinition[];
  readonly agents?: readonly AgentDefinition[];
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
  const ownedAgentsPath = adapter.agentsPath?.(projectDir);
  const agentsPath = ownedAgentsPath ?? projectDir;

  assertInside(skillsPath, projectDir);
  await assertInsideRealPath(skillsPath, projectDir);
  if (ownedAgentsPath !== undefined) {
    assertInside(agentsPath, projectDir);
    await assertInsideRealPath(agentsPath, projectDir);
  }

  const manifest = input.manifest ?? emptyInstallManifest();
  const recorded = manifestEntriesByPath(manifest);
  const mcpServers = input.mcpServers ?? [];
  const hooks = input.hooks ?? [];
  const agents = input.agents ?? [];
  const context = { projectDir, skills: input.skills, mcpServers, hooks, agents };
  const files = adapter.planFiles(context);
  const operations = await Promise.all(
    files.map((file) => planFile(file, projectDir, skillsPath, adapter.id, recorded, input.force)),
  );
  const agentFiles = adapter.capabilities.agents ? (adapter.planAgents?.(context) ?? []) : [];
  if (agentFiles.length > 0 && ownedAgentsPath === undefined) {
    throw new InvalidAdapterConfigurationError(
      adapter.id,
      "it plans agents without declaring its owned directory",
    );
  }
  const agentOperations = await Promise.all(
    agentFiles.map((file) =>
      planAgentFile(file, projectDir, agentsPath, adapter.id, recorded, input.force),
    ),
  );
  // Qwen Code reads MCP servers and hooks from one document, which can only be planned — and
  // written, and owned — as a single merge. Every other provider keeps them apart.
  const sharedSettings = await planSharedSettings({
    adapter,
    context,
    projectDir,
    recorded,
    prune: input.prune === true,
  });
  const mcp =
    sharedSettings ??
    (await planMcp({
      adapter,
      context,
      projectDir,
      recorded,
      prune: input.prune === true,
    }));
  const hookConfig =
    sharedSettings === undefined
      ? await planHooks({
          adapter,
          context,
          projectDir,
          recorded,
          prune: input.prune === true,
        })
      : // The shared document already carries this target's hooks; a second operation would be a
        // second write to the same path.
        {
          operations: [] as readonly HookInstallOperation[],
          deletions: [] as readonly DeleteOperation[],
        };
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
        ...hookConfig.deletions,
        ...(ownedAgentsPath === undefined
          ? []
          : await planAgentDeletions({
              manifest,
              target: adapter.id,
              projectDir,
              agentsPath,
              desired: new Set(agentOperations.map((op) => op.relativePath)),
              plannedTargets: new Set(input.plannedTargets ?? [input.target]),
            })),
      ]
    : [];

  return {
    target: adapter.id,
    name: adapter.name,
    projectDir,
    skillsPath,
    agentsPath,
    relativeSkillsPath: toDisplayPath(projectDir, skillsPath),
    operations,
    agentOperations,
    mcpOperations: mcp.operations,
    hookOperations: hookConfig.operations,
    deletions,
    unsupportedMcp:
      mcpServers.length > 0 && !adapter.capabilities.mcp.project
        ? mcpServers.map((server) => server.name)
        : [],
    unsupportedAgents:
      agents.length > 0 && !adapter.capabilities.agents ? agents.map(({ name }) => name) : [],
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
  input: Omit<PlanInstallInput, "skills" | "mcpServers" | "hooks" | "agents" | "prune">,
): Promise<InstallPlan[]> {
  return planInstall({ ...input, skills: [], mcpServers: [], hooks: [], agents: [], prune: true });
}

async function planAgentFile(
  file: PlannedAgentFile,
  projectDir: string,
  agentsPath: string,
  target: string,
  recorded: ReadonlyMap<string, InstallManifestEntry>,
  force: boolean | undefined,
): Promise<InstallOperation> {
  const path = resolve(projectDir, join(...file.segments));
  assertInside(path, agentsPath);
  await assertInsideRealPath(path, agentsPath);
  const relativePath = toDisplayPath(projectDir, path);
  const entry = recorded.get(relativePath);
  const installed = await readInstalled(path);
  return {
    type: "write-file",
    status: classify(
      installed,
      file.content,
      entry?.kind === "agent" ? entry.hash : undefined,
      force,
    ),
    path,
    relativePath,
    skill: "",
    agent: file.agent,
    content: file.content,
    observed: observedState(installed),
    usedBy: [target],
  };
}

async function planAgentDeletions(input: {
  manifest: InstallManifest;
  target: string;
  projectDir: string;
  agentsPath: string;
  desired: ReadonlySet<string>;
  plannedTargets: ReadonlySet<string>;
}): Promise<DeleteOperation[]> {
  const entries = input.manifest.entries.filter(
    (entry): entry is AgentManifestEntry =>
      entry.kind === "agent" &&
      entry.targets.includes(input.target) &&
      !input.desired.has(entry.path) &&
      entry.targets.every((target) => input.plannedTargets.has(target)),
  );
  return Promise.all(
    entries.map(async (entry) => {
      const path = resolve(input.projectDir, ...entry.path.split("/"));
      assertInside(path, input.agentsPath);
      await assertInsideRealPath(path, input.agentsPath);
      const installed = await readInstalled(path);
      return {
        type: "delete-file" as const,
        status: deletionStatus(installed, entry.hash),
        kind: "agent" as const,
        path,
        relativePath: entry.path,
        skill: undefined,
        agent: entry.agent,
        observed: observedState(installed),
        usedBy: entry.targets,
      };
    }),
  );
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
  const installed = await readInstalled(path);
  const status = classify(
    installed,
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
    observed: observedState(installed),
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

  const supported = adapter.capabilities.mcp.transports;

  if (supported !== undefined) {
    for (const server of context.mcpServers) {
      if (!supported.includes(server.transport)) {
        throw new UnsupportedMcpTransportError(adapter.id, server.name, server.transport);
      }
    }
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

  const existingContent = await readExistingProviderConfig(configPath);
  const planned = adapter.planMcpConfig(context, { content: existingContent, remove });

  if (planned.empty && recordedEntry?.created === true) {
    return {
      operations: [],
      deletions: [
        {
          type: "delete-file",
          status: deletionStatus(existingContent, recordedEntry.hash),
          kind: "mcp",
          path: configPath,
          relativePath,
          skill: undefined,
          observed: observedState(existingContent),
          usedBy: recordedEntry.targets,
        },
      ],
    };
  }

  const path = resolve(projectDir, join(...planned.segments));

  assertInside(path, projectDir);
  await assertInsideRealPath(path, projectDir);

  // The merged document was built from `existingContent`, so that read is the state to guard.
  const installed = path === configPath ? existingContent : await readInstalled(path);

  return {
    operations: [
      {
        type: "configure-mcp",
        status: classify(installed, planned.content, undefined, true),
        path,
        relativePath: toDisplayPath(projectDir, path),
        servers: planned.servers,
        content: planned.content,
        created: existingContent === undefined,
        observed: observedState(installed),
        usedBy: [adapter.id],
      },
    ],
    deletions: [],
  };
}

interface PlanHooksInput {
  readonly adapter: AgentAdapter;
  readonly context: {
    readonly projectDir: string;
    readonly skills: readonly SkillDefinition[];
    readonly hooks: readonly HookDefinition[];
  };
  readonly projectDir: string;
  readonly recorded: ReadonlyMap<string, InstallManifestEntry>;
  readonly prune: boolean;
}

/**
 * Plans the provider's hook configuration.
 *
 * Mirrors `planMcp` exactly: the destination file belongs to the user, so
 * Agentyx merges its own hook entries into whatever is there and carries
 * everything else through untouched. Pruning removes only the hooks the
 * manifest says Agentyx added, and the file itself is removed only when
 * Agentyx created it and nothing is left in it.
 */
async function planHooks(input: PlanHooksInput): Promise<{
  readonly operations: readonly HookInstallOperation[];
  readonly deletions: readonly DeleteOperation[];
}> {
  const { adapter, context, projectDir, recorded, prune } = input;

  if (!adapter.capabilities.hooks || adapter.planHookConfig === undefined) {
    return { operations: [], deletions: [] };
  }

  const configPath = adapter.hooksConfigPath?.(projectDir);

  if (configPath === undefined) {
    return { operations: [], deletions: [] };
  }

  assertInside(configPath, projectDir);
  await assertInsideRealPath(configPath, projectDir);

  const relativePath = toDisplayPath(projectDir, configPath);
  const entry = recorded.get(relativePath);
  const recordedEntry: HookManifestEntry | undefined = entry?.kind === "hook" ? entry : undefined;
  const desired = new Set(context.hooks.map((hook) => hook.name));
  const remove = prune
    ? (recordedEntry?.hooks ?? []).filter((name) => !desired.has(name))
    : ([] as readonly string[]);

  if (context.hooks.length === 0 && remove.length === 0) {
    return { operations: [], deletions: [] };
  }

  const existingContent = await readExistingProviderConfig(configPath);
  const siblingPath = adapter.hooksSiblingConfigPath?.(projectDir);
  const sibling =
    siblingPath === undefined ? undefined : await readExistingProviderConfig(siblingPath);
  const planned = adapter.planHookConfig(context, { content: existingContent, remove, sibling });

  if (planned.skipped !== undefined) {
    return { operations: [], deletions: [] };
  }

  if (planned.empty && recordedEntry?.created === true) {
    return {
      operations: [],
      deletions: [
        {
          type: "delete-file",
          status: deletionStatus(existingContent, recordedEntry.hash),
          kind: "hook",
          path: configPath,
          relativePath,
          skill: undefined,
          observed: observedState(existingContent),
          usedBy: recordedEntry.targets,
        },
      ],
    };
  }

  const path = resolve(projectDir, join(...planned.segments));

  assertInside(path, projectDir);
  await assertInsideRealPath(path, projectDir);

  const installed = path === configPath ? existingContent : await readInstalled(path);

  return {
    operations: [
      {
        type: "configure-hooks",
        status: classify(installed, planned.content, undefined, true),
        path,
        relativePath: toDisplayPath(projectDir, path),
        hooks: planned.hooks,
        content: planned.content,
        created: existingContent === undefined,
        observed: observedState(installed),
        usedBy: [adapter.id],
      },
    ],
    deletions: [],
  };
}

interface PlanSharedSettingsInput {
  readonly adapter: AgentAdapter;
  readonly context: {
    readonly projectDir: string;
    readonly skills: readonly SkillDefinition[];
    readonly mcpServers: readonly McpServerDefinition[];
    readonly hooks: readonly HookDefinition[];
  };
  readonly projectDir: string;
  readonly recorded: ReadonlyMap<string, InstallManifestEntry>;
  readonly prune: boolean;
}

/**
 * Plans the single document a provider reads both MCP servers and hooks from.
 *
 * Two merges of one file cannot be planned independently: each would read the file from disk, so
 * the second write would drop what the first added, and the by-path manifest index could only keep
 * one of the two ownership records — losing the names needed to prune the other half. So the MCP
 * merge runs first and its *output* is handed to the hook merge as the document to merge into.
 * Both merges preserve keys they do not own, which is what makes the composition safe. The result
 * is one operation and one `settings` manifest entry.
 *
 * Returns `undefined` when the adapter keeps the two in separate files, as every provider except
 * Qwen Code does, so the caller falls back to the independent plans.
 */
async function planSharedSettings(input: PlanSharedSettingsInput): Promise<
  | {
      readonly operations: readonly McpInstallOperation[];
      readonly deletions: readonly DeleteOperation[];
    }
  | undefined
> {
  const { adapter, context, projectDir, recorded, prune } = input;
  const configPath = sharedSettingsPath(adapter, projectDir);

  if (
    configPath === undefined ||
    adapter.planMcpConfig === undefined ||
    adapter.planHookConfig === undefined
  ) {
    return undefined;
  }

  const supported = adapter.capabilities.mcp.transports;

  if (supported !== undefined) {
    for (const server of context.mcpServers) {
      if (!supported.includes(server.transport)) {
        throw new UnsupportedMcpTransportError(adapter.id, server.name, server.transport);
      }
    }
  }

  assertInside(configPath, projectDir);
  await assertInsideRealPath(configPath, projectDir);

  const relativePath = toDisplayPath(projectDir, configPath);
  const entry = recorded.get(relativePath);
  // A lock written before this provider shared one document may attribute the path to only one of
  // the two halves. Either way, the names it recorded are the names to prune.
  const recordedEntry =
    entry?.kind === "settings" || entry?.kind === "mcp" || entry?.kind === "hook"
      ? entry
      : undefined;
  const recordedServers =
    recordedEntry === undefined || recordedEntry.kind === "hook" ? [] : recordedEntry.servers;
  const recordedHooks =
    recordedEntry === undefined || recordedEntry.kind === "mcp" ? [] : recordedEntry.hooks;
  const desiredServers = new Set(context.mcpServers.map((server) => server.name));
  const desiredHooks = new Set(context.hooks.map((hook) => hook.name));
  const removeServers = prune
    ? recordedServers.filter((name) => !desiredServers.has(name))
    : ([] as readonly string[]);
  const removeHooks = prune
    ? recordedHooks.filter((name) => !desiredHooks.has(name))
    : ([] as readonly string[]);

  if (
    context.mcpServers.length === 0 &&
    context.hooks.length === 0 &&
    removeServers.length === 0 &&
    removeHooks.length === 0
  ) {
    return { operations: [], deletions: [] };
  }

  const existingContent = await readExistingProviderConfig(configPath);
  const withServers = adapter.planMcpConfig(context, {
    content: existingContent,
    remove: removeServers,
  });
  const withHooks = adapter.planHookConfig(context, {
    content: withServers.content,
    remove: removeHooks,
  });
  // A provider that declines to write hooks keeps its servers; only Codex declines, and it never
  // shares a document, so this is a guard rather than a path Qwen Code takes.
  const declined = withHooks.skipped !== undefined;
  const content = declined ? withServers.content : withHooks.content;
  const path = resolve(projectDir, join(...(declined ? withServers.segments : withHooks.segments)));

  assertInside(path, projectDir);
  await assertInsideRealPath(path, projectDir);

  if ((declined ? withServers.empty : withHooks.empty) && recordedEntry?.created === true) {
    return {
      operations: [],
      deletions: [
        {
          type: "delete-file",
          status: deletionStatus(existingContent, recordedEntry.hash),
          kind: "settings",
          path: configPath,
          relativePath,
          skill: undefined,
          observed: observedState(existingContent),
          usedBy: recordedEntry.targets,
        },
      ],
    };
  }

  return {
    operations: [
      {
        type: "configure-mcp",
        // The merged document was built from `existingContent`, so that read is the state to guard.
        status: classify(existingContent, content, undefined, true),
        path,
        relativePath: toDisplayPath(projectDir, path),
        servers: context.mcpServers.map((server) => server.name),
        hooks: declined ? [] : withHooks.hooks,
        content,
        created: existingContent === undefined,
        observed: observedState(existingContent),
        usedBy: [adapter.id],
      },
    ],
    deletions: [],
  };
}

/** The document a provider reads both MCP servers and hooks from, when it keeps them together. */
function sharedSettingsPath(adapter: AgentAdapter, projectDir: string): string | undefined {
  if (!adapter.capabilities.mcp.project || !adapter.capabilities.hooks) {
    return undefined;
  }

  const mcp = adapter.mcpConfigPath?.(projectDir);
  const hooks = adapter.hooksConfigPath?.(projectDir);

  return mcp !== undefined && mcp === hooks ? mcp : undefined;
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

      const installed = await readInstalled(path);

      return {
        type: "delete-file" as const,
        status: deletionStatus(installed, entry.hash),
        kind: "skill" as const,
        path,
        relativePath: entry.path,
        skill: entry.skill,
        observed: observedState(installed),
        usedBy: entry.targets,
      };
    }),
  );
}

async function readExistingProviderConfig(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw cause;
  }
}

async function readInstalled(path: string): Promise<string | undefined> {
  return readExistingProviderConfig(path);
}

function observedState(installed: string | undefined): ObservedFileState {
  return installed === undefined
    ? { kind: "missing" }
    : { kind: "file", hash: hashContent(installed) };
}

/**
 * Decides what writing `content` over `installed` would mean.
 *
 * `recordedHash` is the digest the manifest holds for this path. When it is
 * absent, or does not match what is on disk, the file is someone else's and the
 * result is a `conflict` — the single rule that covers both a pre-existing file
 * and a managed file edited by hand.
 *
 * `force` only changes this decision, for the state that was just read. The
 * executor still requires the destination to match that state when it writes.
 */
function classify(
  installed: string | undefined,
  content: string,
  recordedHash: string | undefined,
  force: boolean | undefined,
): InstallOperationStatus {
  if (installed === undefined) {
    return "create";
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
function deletionStatus(
  installed: string | undefined,
  recordedHash: string,
): DeleteOperationStatus {
  if (installed === undefined) {
    return "unchanged";
  }

  return hashContent(installed) === recordedHash ? "delete" : "conflict";
}

function annotateSharedOperations(plans: readonly InstallPlan[]): InstallPlan[] {
  const byPath = new Map<string, { readonly content: string; readonly targets: Set<string> }>();

  for (const plan of plans) {
    for (const operation of [
      ...plan.operations,
      ...plan.agentOperations,
      ...plan.mcpOperations,
      ...plan.hookOperations,
    ]) {
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
    agentOperations: plan.agentOperations.map((operation) => ({
      ...operation,
      usedBy: usedBy.get(operationKey(operation.path, operation.content)) ?? [plan.target],
    })),
    mcpOperations: plan.mcpOperations.map((operation) => ({
      ...operation,
      usedBy: usedBy.get(operationKey(operation.path, operation.content)) ?? [plan.target],
    })),
    hookOperations: plan.hookOperations.map((operation) => ({
      ...operation,
      usedBy: usedBy.get(operationKey(operation.path, operation.content)) ?? [plan.target],
    })),
  }));
}

function operationKey(path: string, content: string): string {
  return `${path}\u0000${content}`;
}
