import type { Dirent } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { PackRegistry } from "../pack/registry.js";
import { builtInPackRegistry, builtInPacks, createPackRegistry } from "../pack/registry.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import { parseSkillMarkdown } from "../skill/markdown.js";
import { createSkillRegistry, type SkillRegistry, type SkillSource } from "../skill/registry.js";
import type { SkillDefinition } from "../skill/schema.js";
import { LocalSkillDirectoryError } from "./errors.js";
import { loadAgentyxConfig } from "./loader.js";
import type { AgentyxConfig } from "./schema.js";

/** A validated project configuration plus the registries it owns. */
export interface AgentyxProject {
  readonly config: AgentyxConfig;
  readonly packRegistry: PackRegistry;
  readonly skillRegistry: SkillRegistry;
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
  const localSources = await loadLocalSkillSources(projectDir, config.skillDirectories ?? []);
  const skillRegistry = createSkillRegistry([
    ...builtInSkillRegistry.names.map(
      (name): SkillSource => ({
        name,
        load: () => builtInSkillRegistry.get(name),
      }),
    ),
    ...localSources,
  ]);
  const packRegistry =
    config.localPacks === undefined
      ? builtInPackRegistry
      : createPackRegistry([...builtInPacks, ...config.localPacks]);

  return { config, packRegistry, skillRegistry };
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
      let markdown: string;

      try {
        markdown = await readFile(filePath, "utf8");
      } catch (cause) {
        if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

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
