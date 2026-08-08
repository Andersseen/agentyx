import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_SKILLS_PATH } from "../assets.js";
import { InvalidSkillError } from "./errors.js";
import { parseSkillMarkdown } from "./markdown.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";
import type { SkillDefinition } from "./schema.js";

/**
 * The skills Agnox ships with. The names are the directory names under
 * `packages/core/skills`, and knowing them without touching the filesystem is
 * what lets stack resolution validate references without reading any body.
 */
export const builtInSkillNames = [
  "planning",
  "systematic-debugging",
  "verification",
  "typescript-modern",
  "angular-modern",
] as const;

/** The absolute path of a built-in skill's `SKILL.md`. */
export function builtInSkillPath(name: string): string {
  return join(BUILT_IN_SKILLS_PATH, name, "SKILL.md");
}

/** The registry used by default when no explicit registry is supplied. */
export const builtInSkillRegistry: SkillRegistry = createSkillRegistry(
  builtInSkillNames.map((name) => ({ name, load: () => loadBuiltInSkill(name) })),
);

/**
 * Reads one built-in `SKILL.md`.
 *
 * Reading is synchronous on purpose: the files are small package assets, they
 * are only touched when a command asks for instructions, and a synchronous read
 * keeps `SkillRegistry.get` a plain lookup instead of infecting every caller
 * with a promise.
 */
function loadBuiltInSkill(name: string): SkillDefinition {
  const filePath = builtInSkillPath(name);
  let markdown: string;

  try {
    markdown = readFileSync(filePath, "utf8");
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);

    throw new InvalidSkillError(filePath, `the file could not be read: ${reason}`, { cause });
  }

  return parseSkillMarkdown(markdown, filePath);
}
