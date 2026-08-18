import type { Dirent } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseSkillMarkdown } from "../skill/markdown.js";
import { TrustedSourceLoadError } from "./errors.js";
import { getTrustedSourceDefinition } from "./registry.js";
import {
  type CodexPluginManifest,
  codexPluginManifestSchema,
  type TrustedSourceDefinition,
  type TrustedSourceReference,
  type TrustedSourceSkillSummary,
} from "./schema.js";

export interface TrustedSourceInspection {
  readonly definition: TrustedSourceDefinition;
  readonly reference: TrustedSourceReference;
  readonly rootPath: string;
  readonly manifest: CodexPluginManifest;
  readonly skillsPath: string;
  readonly skills: readonly TrustedSourceSkillSummary[];
  readonly installable: boolean;
  readonly installNote: string;
}

export async function inspectTrustedSource(
  projectPath: string,
  reference: TrustedSourceReference,
): Promise<TrustedSourceInspection> {
  const definition = getTrustedSourceDefinition(reference);
  const projectDir = resolve(projectPath);
  const projectRealPath = await realpath(projectDir);
  const root = resolve(projectDir, reference.path);
  const rootRealPath = await realpathOrThrow(
    reference.name,
    root,
    "the checkout path cannot be read",
  );

  if (!isInside(rootRealPath, projectRealPath)) {
    throw new TrustedSourceLoadError(
      reference.name,
      "the checkout path resolves outside the project",
    );
  }

  const manifestPath = join(rootRealPath, definition.manifestPath);
  const manifest = await readManifest(reference.name, manifestPath);

  if (manifest.name !== definition.name) {
    throw new TrustedSourceLoadError(
      reference.name,
      `${definition.manifestPath} declares the name "${manifest.name}"`,
    );
  }

  if (manifest.repository !== definition.repository) {
    throw new TrustedSourceLoadError(
      reference.name,
      `${definition.manifestPath} declares repository "${manifest.repository}"`,
    );
  }

  const skillsPath = resolve(dirname(manifestPath), manifest.skills);

  if (!isInside(skillsPath, rootRealPath)) {
    throw new TrustedSourceLoadError(
      reference.name,
      "the manifest skills path resolves outside the checkout",
    );
  }

  const skillsRealPath = await realpathOrThrow(
    reference.name,
    skillsPath,
    "the manifest skills path cannot be read",
  );

  if (!isInside(skillsRealPath, rootRealPath)) {
    throw new TrustedSourceLoadError(
      reference.name,
      "the manifest skills path resolves outside the checkout",
    );
  }

  const skills = await inspectSkillSummaries(reference.name, skillsRealPath);
  const installable =
    definition.installStatus === "installable" && skills.every((skill) => !skill.hasResources);

  return {
    definition,
    reference,
    rootPath: rootRealPath,
    manifest,
    skillsPath: skillsRealPath,
    skills,
    installable,
    installNote: definition.installNote,
  };
}

async function readManifest(sourceName: string, path: string): Promise<CodexPluginManifest> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    throw trustedSourceLoadError(sourceName, "the plugin manifest cannot be read", cause);
  }

  try {
    return codexPluginManifestSchema.parse(JSON.parse(raw));
  } catch (cause) {
    throw trustedSourceLoadError(sourceName, "the plugin manifest is invalid", cause);
  }
}

async function inspectSkillSummaries(
  sourceName: string,
  skillsPath: string,
): Promise<readonly TrustedSourceSkillSummary[]> {
  let entries: Dirent[];

  try {
    entries = await readdir(skillsPath, { withFileTypes: true });
  } catch (cause) {
    throw trustedSourceLoadError(sourceName, "the plugin skills directory cannot be listed", cause);
  }

  const skills: TrustedSourceSkillSummary[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillRoot = join(skillsPath, entry.name);
    const skillPath = join(skillRoot, "SKILL.md");
    let markdown: string;

    try {
      markdown = await readFile(skillPath, "utf8");
    } catch (cause) {
      if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw trustedSourceLoadError(sourceName, `cannot read ${entry.name}/SKILL.md`, cause);
    }

    const skill = parseSkillMarkdown(markdown, skillPath);

    if (skill.name !== entry.name) {
      throw new TrustedSourceLoadError(
        sourceName,
        `${entry.name}/SKILL.md declares the name "${skill.name}"`,
      );
    }

    skills.push({
      name: skill.name,
      description: skill.description,
      hasResources: await hasResources(skillRoot),
    });
  }

  return skills;
}

async function hasResources(skillRoot: string): Promise<boolean> {
  const entries = await readdir(skillRoot, { withFileTypes: true });

  return entries.some((entry) => entry.name !== "SKILL.md");
}

async function realpathOrThrow(sourceName: string, path: string, reason: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (cause) {
    throw trustedSourceLoadError(sourceName, reason, cause);
  }
}

function isInside(path: string, root: string): boolean {
  const pathFromRoot = relative(root, path);

  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !isAbsolute(pathFromRoot))
  );
}

function trustedSourceLoadError(
  sourceName: string,
  reason: string,
  cause: unknown,
): TrustedSourceLoadError {
  return new TrustedSourceLoadError(
    sourceName,
    reason,
    cause instanceof Error ? { cause } : undefined,
  );
}
