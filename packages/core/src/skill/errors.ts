import type { ZodError } from "zod";
import { AgentyxError } from "../errors.js";

/**
 * Raised when a pack references a skill the registry does not know.
 *
 * The offending name is exposed as `skillName`; `pack` stays the JS pack
 * trace inherited from `Error`.
 */
export class UnknownSkillError extends AgentyxError {
  readonly skillName: string;
  /** The pack that declared the skill, when the failure came from resolution. */
  readonly requiredBy: string | undefined;
  readonly knownSkills: readonly string[];

  constructor(skillName: string, requiredBy: string | undefined, knownSkills: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by pack "${requiredBy}")`;
    const known = knownSkills.length > 0 ? [...knownSkills].sort().join(", ") : "none";

    super("unknown_skill", `Unknown skill "${skillName}"${origin}. Known skills: ${known}.`);
    this.name = "UnknownSkillError";
    this.skillName = skillName;
    this.requiredBy = requiredBy;
    this.knownSkills = knownSkills;
  }
}

/** Raised when a registry is built from sources that reuse a skill name. */
export class DuplicateSkillError extends AgentyxError {
  readonly skillName: string;

  constructor(skillName: string) {
    super("duplicate_skill", `Duplicate skill definition: "${skillName}".`);
    this.name = "DuplicateSkillError";
    this.skillName = skillName;
  }
}

/**
 * Raised when a skill exists but cannot be turned into a valid definition —
 * malformed `SKILL.md` frontmatter, a missing field, an unreadable file.
 *
 * Built-in skills ship with Agentyx, so this is a programmer error rather than
 * something a user can fix in their project.
 */
export class InvalidSkillError extends AgentyxError {
  /** Where the skill came from: a file path, or a label for an in-memory source. */
  readonly origin: string;
  readonly reason: string;

  constructor(origin: string, reason: string | ZodError, options?: ErrorOptions) {
    const detail = typeof reason === "string" ? reason : formatIssues(reason);

    super("invalid_skill", `Invalid skill in ${origin}: ${detail}`, options);
    this.name = "InvalidSkillError";
    this.origin = origin;
    this.reason = detail;
  }
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");

      return path === "" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");
}
