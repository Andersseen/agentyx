import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { formatSkillMarkdown } from "@agnox/core";
import type { AdapterContext, AgentAdapter, PlannedFile } from "./adapter.js";

/** The file name every provider in this family expects inside a skill directory. */
export const SKILL_FILENAME = "SKILL.md";

/** What distinguishes one skill-directory provider from another: an id, a name, a location. */
export interface SkillDirectoryAdapterDefinition {
  readonly id: string;
  readonly name: string;
  /**
   * Directory segments below the project root that this provider scans for
   * skills, for example `[".claude", "skills"]`. Segments, not a string, so no
   * separator is ever written by hand.
   */
  readonly skillsDir: readonly string[];
  /** Why this location — kept next to the value so the choice stays auditable. */
  readonly reference: string;
}

/**
 * Builds an adapter for the providers that read skills as
 * `<skills directory>/<skill name>/SKILL.md`.
 *
 * Codex and Claude Code both work this way, and both consume the canonical
 * `SKILL.md` that `@agnox/core` renders, so the *only* thing that differs
 * between them is the directory. Sharing the mechanism here is what keeps that
 * true: neither provider owns skill content, a serializer, or install logic.
 *
 * A provider that genuinely needs a different file layout implements
 * `AgentAdapter` directly instead of using this.
 *
 * Ownership: the generated paths are derived entirely from resolved skill
 * names, so Agnox only ever manages `<skills directory>/<skill name>/SKILL.md`
 * for skills it resolved. Anything else in the provider's directory — other
 * skills, settings files — is never read, planned or written.
 */
export function createSkillDirectoryAdapter(
  definition: SkillDirectoryAdapterDefinition,
): AgentAdapter {
  const skillsPath = (projectDir: string): string =>
    resolve(projectDir, join(...definition.skillsDir));

  return {
    id: definition.id,
    name: definition.name,
    skillsPath,
    detect: async (projectDir) => {
      const path = skillsPath(projectDir);

      return { target: definition.id, skillsPath: path, present: await isDirectory(path) };
    },
    planFiles: (context: AdapterContext): readonly PlannedFile[] =>
      context.skills.map((skill) => ({
        segments: [...definition.skillsDir, skill.name, SKILL_FILENAME],
        content: formatSkillMarkdown(skill),
        skill: skill.name,
      })),
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
