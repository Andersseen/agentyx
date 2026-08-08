import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { McpServerDefinition, SkillDefinition } from "@agnox/core";
import type { PlannedFile } from "./adapter.js";
import { builtInAdapterRegistry } from "./built-in.js";
import { MissingInstallTargetsError } from "./errors.js";
import { assertInside, toDisplayPath } from "./path.js";
import type {
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
  readonly registry?: AdapterRegistry;
}

export interface PlanInstallInput extends Omit<PlanTargetInstallInput, "target"> {
  readonly targets: readonly string[];
}

/**
 * Works out everything one target needs, and changes nothing.
 *
 * The adapter contributes the desired files; comparing them with what is on
 * disk happens here, once, for every provider. Planning reads the destination
 * files to classify each operation as `create`, `update` or `unchanged`, but it
 * never creates, moves or writes anything — a plan is safe to discard.
 *
 * @throws {UnknownAdapterError} when no adapter is registered for the target.
 * @throws {InstallPathError} when the adapter asks for a file outside the directory it owns.
 */
export async function planTargetInstall(input: PlanTargetInstallInput): Promise<InstallPlan> {
  const adapter = (input.registry ?? builtInAdapterRegistry).get(input.target);
  const projectDir = resolve(input.projectDir);
  const skillsPath = adapter.skillsPath(projectDir);

  assertInside(skillsPath, projectDir);

  const mcpServers = input.mcpServers ?? [];
  const context = { projectDir, skills: input.skills, mcpServers };
  const files = adapter.planFiles(context);
  const operations = await Promise.all(files.map((file) => planFile(file, projectDir, skillsPath)));
  const mcpOperations =
    mcpServers.length > 0 && adapter.capabilities.mcp.project && adapter.planMcpConfig !== undefined
      ? [
          await planMcpConfig(
            adapter.planMcpConfig(context, await readExistingMcpConfig(adapter, projectDir)),
            projectDir,
          ),
        ]
      : [];

  return {
    target: adapter.id,
    name: adapter.name,
    projectDir,
    skillsPath,
    relativeSkillsPath: toDisplayPath(projectDir, skillsPath),
    operations,
    mcpOperations,
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

  return Promise.all(targets.map((target) => planTargetInstall({ ...input, target })));
}

async function planFile(
  file: PlannedFile,
  projectDir: string,
  skillsPath: string,
): Promise<InstallOperation> {
  const path = resolve(projectDir, join(...file.segments));

  assertInside(path, skillsPath);

  return {
    type: "write-file",
    status: await statusOf(path, file.content),
    path,
    relativePath: toDisplayPath(projectDir, path),
    skill: file.skill,
    content: file.content,
  };
}

async function planMcpConfig(
  file: {
    readonly segments: readonly string[];
    readonly content: string;
    readonly servers: readonly string[];
  },
  projectDir: string,
): Promise<McpInstallOperation> {
  const path = resolve(projectDir, join(...file.segments));

  assertInside(path, projectDir);

  return {
    type: "configure-mcp",
    status: await statusOf(path, file.content),
    path,
    relativePath: toDisplayPath(projectDir, path),
    servers: file.servers,
    content: file.content,
  };
}

async function readExistingMcpConfig(
  adapter: { mcpConfigPath?(projectDir: string): string },
  projectDir: string,
): Promise<string | undefined> {
  const path = adapter.mcpConfigPath?.(projectDir);

  if (path === undefined) {
    return undefined;
  }

  assertInside(path, projectDir);

  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw cause;
  }
}

async function statusOf(path: string, content: string): Promise<InstallOperationStatus> {
  let installed: string;

  try {
    installed = await readFile(path, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return "create";
    }

    throw cause;
  }

  return installed === content ? "unchanged" : "update";
}
