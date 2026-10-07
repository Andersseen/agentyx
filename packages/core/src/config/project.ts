import type { Dirent } from "node:fs";
import { readFileSync } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { PROJECT_CONTEXT_TEMPLATE_PATH } from "../assets.js";
import type { PackRegistry } from "../pack/registry.js";
import { builtInPackRegistry, builtInPacks, createPackRegistry } from "../pack/registry.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import { DuplicateSkillError } from "../skill/errors.js";
import { parseSkillMarkdown } from "../skill/markdown.js";
import { createSkillRegistry, type SkillRegistry, type SkillSource } from "../skill/registry.js";
import type { SkillDefinition } from "../skill/schema.js";
import { getTrustedSourceDefinition } from "../source/registry.js";
import { LocalSkillDirectoryError, ProjectContextPathError } from "./errors.js";
import { loadAgentyxConfig } from "./loader.js";
import type { AgentyxConfig } from "./schema.js";

/** A validated project configuration plus the registries it owns. */
export interface AgentyxProject {
  readonly config: AgentyxConfig;
  readonly packRegistry: PackRegistry;
  readonly skillRegistry: SkillRegistry;
  readonly graph: import("../project-graph.js").ProjectGraph | undefined;
}

/**
 * Loads `.agentyx.json` and any checked-in Agent Skills it declares.
 *
 * A Skill root contains one directory per Skill, each with a `SKILL.md`. Roots must resolve inside
 * the project even through symlinks. Loading is local-only: this function never clones a repository
 * or accesses the network.
 */
export async function loadAgentyxProject(
  projectPath: string = process.cwd(),
): Promise<AgentyxProject> {
  const projectDir = resolve(projectPath);
  const config = await loadAgentyxConfig(projectDir);
  await validateContextPaths(projectDir, config.context);
  for (const source of config.trustedSources ?? []) {
    getTrustedSourceDefinition(source);
  }

  const localSources = await loadLocalSkillSources(projectDir, config.skillDirectories ?? []);
  if (localSources.some((source) => source.name === "agentyx-project-context")) {
    throw new DuplicateSkillError("agentyx-project-context");
  }
  const generatedSources =
    config.project !== undefined || (config.context !== undefined && hasContext(config.context))
      ? [createProjectContextSkill(config.project, config.relations ?? [], config.context)]
      : [];
  const skillRegistry = createSkillRegistry([
    ...builtInSkillRegistry.names.map(
      (name): SkillSource => ({
        name,
        load: () => builtInSkillRegistry.get(name),
      }),
    ),
    ...localSources,
    ...generatedSources,
  ]);
  const packRegistry =
    config.localPacks === undefined
      ? builtInPackRegistry
      : createPackRegistry([...builtInPacks, ...config.localPacks]);

  const graph =
    config.project === undefined
      ? undefined
      : { project: config.project, relations: config.relations ?? [] };
  return { config, packRegistry, skillRegistry, graph };
}

function createProjectContextSkill(
  project: import("./schema.js").ProjectMetadata | undefined,
  relations: readonly import("./schema.js").ProjectRelation[],
  context: import("./schema.js").ProjectContext | undefined,
): SkillSource {
  return {
    name: "agentyx-project-context",
    load: () => {
      const template = readFileSync(PROJECT_CONTEXT_TEMPLATE_PATH, "utf8").trim();
      const data = JSON.stringify({ project, relations, context }, null, 2);
      const longestFence = Math.max(
        0,
        ...Array.from(data.matchAll(/`+/g), (match) => match[0].length),
      );
      const fence = "`".repeat(Math.max(3, longestFence + 1));
      return {
        name: "agentyx-project-context",
        description: "Repository facts and direct architectural relationships.",
        content: template.replace("{{PROJECT_FACTS}}", `${fence}json\n${data}\n${fence}`),
      };
    },
  };
}

function hasContext(context: import("./schema.js").ProjectContext): boolean {
  return (
    Object.keys(context.commands).length > 0 ||
    context.areas.length > 0 ||
    context.constraints.length > 0
  );
}

async function validateContextPaths(
  projectDir: string,
  context: import("./schema.js").ProjectContext | undefined,
): Promise<void> {
  if (context === undefined) return;
  const paths = [
    ...Object.values(context.commands).map(({ cwd }) => cwd),
    ...context.areas.map(({ path }) => path),
  ];
  const projectRealPath = await realpath(projectDir);
  for (const path of paths) {
    if (/^(?:\/|[A-Za-z]:)|\\|(?:^|\/)\.\.(?:\/|$)/.test(path)) {
      throw new ProjectContextPathError(
        path,
        "it must be project-relative and cannot traverse parents",
      );
    }
    const resolvedPath = resolve(projectDir, path);
    let resolvedRealPath: string;
    try {
      resolvedRealPath = await realpath(resolvedPath);
      const pathStat = await stat(resolvedRealPath);
      if (!pathStat.isDirectory()) {
        throw new ProjectContextPathError(path, "it must name a directory");
      }
    } catch (cause) {
      if (cause instanceof ProjectContextPathError) throw cause;
      throw new ProjectContextPathError(
        path,
        "it does not exist or cannot be read",
        cause instanceof Error ? { cause } : undefined,
      );
    }
    if (!isInside(resolvedRealPath, projectRealPath)) {
      throw new ProjectContextPathError(path, "it resolves outside the project");
    }
  }
}

async function loadLocalSkillSources(
  projectDir: string,
  directories: readonly string[],
): Promise<readonly SkillSource[]> {
  const projectRealPath = await realpath(projectDir);
  const sources: SkillSource[] = [];

  for (const directory of directories) {
    const root = resolve(projectDir, directory);
    let rootRealPath: string;

    try {
      rootRealPath = await realpath(root);
    } catch (cause) {
      throw localDirectoryError(directory, "the directory does not exist or cannot be read", cause);
    }

    if (!isInside(rootRealPath, projectRealPath)) {
      throw new LocalSkillDirectoryError(directory, "the resolved path is outside the project");
    }

    let entries: Dirent[];

    try {
      entries = await readdir(rootRealPath, { withFileTypes: true });
    } catch (cause) {
      throw localDirectoryError(directory, "the directory cannot be listed", cause);
    }

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory()) {
        continue;
      }

      const filePath = join(rootRealPath, entry.name, "SKILL.md");
      let realFilePath: string;

      try {
        realFilePath = await realpath(filePath);
      } catch (cause) {
        if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw localDirectoryError(directory, `cannot read ${entry.name}/SKILL.md`, cause);
      }

      if (!isInside(realFilePath, rootRealPath)) {
        throw new LocalSkillDirectoryError(
          directory,
          `${entry.name}/SKILL.md resolves outside the skill directory`,
        );
      }

      let markdown: string;

      try {
        markdown = await readFile(realFilePath, "utf8");
      } catch (cause) {
        throw localDirectoryError(directory, `cannot read ${entry.name}/SKILL.md`, cause);
      }

      const skill: SkillDefinition = parseSkillMarkdown(markdown, filePath);

      if (skill.name !== entry.name) {
        throw new LocalSkillDirectoryError(
          directory,
          `${entry.name}/SKILL.md declares the name "${skill.name}"`,
        );
      }

      sources.push({ name: skill.name, load: () => skill });
    }
  }

  return sources;
}

function isInside(path: string, root: string): boolean {
  const pathFromRoot = relative(root, path);

  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !isAbsolute(pathFromRoot))
  );
}

function localDirectoryError(
  directory: string,
  reason: string,
  cause: unknown,
): LocalSkillDirectoryError {
  return new LocalSkillDirectoryError(
    directory,
    reason,
    cause instanceof Error ? { cause } : undefined,
  );
}
