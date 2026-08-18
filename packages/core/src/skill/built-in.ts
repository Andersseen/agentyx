import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_SKILLS_PATH } from "../assets.js";
import { InvalidSkillError } from "./errors.js";
import { parseSkillMarkdown } from "./markdown.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";
import type { SkillDefinition } from "./schema.js";

/**
 * The skills Agentyx ships with. The names are the directory names under
 * `packages/core/skills`, and knowing them without touching the filesystem is
 * what lets pack resolution validate references without reading any body.
 */
export const builtInSkillNames = [
  "engineering-principles",
  "code-quality",
  "api-design",
  "code-review",
  "planning",
  "systematic-debugging",
  "verification",
  "brainstorming",
  "parallel-work",
  "worktree-workflow",
  "subagent-driven-development",
  "requesting-code-review",
  "typescript-strict",
  "typescript-modeling",
  "typescript-modern",
  "angular-modern",
  "angular-signals",
  "angular-architecture",
  "angular-testing",
  "context-efficient-development",
  "concise-output",
  "targeted-exploration",
  "focused-verification",
  "test-strategy",
  "test-doubles",
  "e2e-testing",
  "flaky-tests",
  "secure-coding",
  "secrets-handling",
  "dependency-security",
  "auth-patterns",
  "performance-profiling",
  "web-vitals",
  "query-performance",
  "semantic-html",
  "aria-patterns",
  "keyboard-navigation",
  "refactoring-safely",
  "legacy-code",
  "dependency-hygiene",
  "technical-writing",
  "api-documentation",
  "decision-records",
  "structured-logging",
  "metrics-and-tracing",
  "incident-response",
  "data-modeling",
  "schema-migrations",
  "transactions-and-consistency",
  "commit-hygiene",
  "branching-strategy",
  "pull-requests",
  "ci-pipelines",
  "containerization",
  "deployment-safety",
  "infrastructure-as-code",
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
