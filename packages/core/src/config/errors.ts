import type { ZodError } from "zod";
import { AgentyxError } from "../errors.js";
import { type AgentyxIssue, toAgentyxIssues } from "../issues.js";

/** A single configuration problem, addressed by its location in the document. */
export type AgentyxConfigIssue = AgentyxIssue;

/** Raised when the supplied directory has no `.agentyx.json`. */
export class AgentyxConfigNotFoundError extends AgentyxError {
  readonly filePath: string;

  constructor(filePath: string, options?: ErrorOptions) {
    super("agentyx_config_not_found", `Agentyx configuration file not found: ${filePath}`, options);
    this.name = "AgentyxConfigNotFoundError";
    this.filePath = filePath;
  }
}

/** Raised when `.agentyx.json` is not valid JSON. */
export class AgentyxConfigParseError extends AgentyxError {
  readonly filePath: string;

  constructor(filePath: string, reason: string, options?: ErrorOptions) {
    super("agentyx_config_parse_error", `${filePath} is not valid JSON: ${reason}`, options);
    this.name = "AgentyxConfigParseError";
    this.filePath = filePath;
  }
}

/** Raised when the document parses as JSON but violates the Agentyx schema. */
export class AgentyxConfigValidationError extends AgentyxError {
  readonly issues: readonly AgentyxConfigIssue[];
  /** The file the configuration came from, when it was read from disk. */
  readonly filePath: string | undefined;

  constructor(error: ZodError, filePath?: string) {
    const issues = toAgentyxIssues(error);
    const location = filePath === undefined ? "" : ` in ${filePath}`;
    const details = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");

    super("agentyx_config_invalid", `Invalid Agentyx configuration${location}:\n${details}`);
    this.name = "AgentyxConfigValidationError";
    this.issues = issues;
    this.filePath = filePath;
  }
}

export class UnknownEnabledCapabilityError extends AgentyxError {
  readonly capabilityName: string;
  readonly knownCapabilities: readonly string[];

  constructor(capabilityName: string, knownCapabilities: readonly string[]) {
    const known = knownCapabilities.length > 0 ? [...knownCapabilities].sort().join(", ") : "none";

    super(
      "unknown_enabled_capability",
      `Unknown enabled capability "${capabilityName}". Known optional capabilities: ${known}.`,
    );
    this.name = "UnknownEnabledCapabilityError";
    this.capabilityName = capabilityName;
    this.knownCapabilities = knownCapabilities;
  }
}

/** Raised when a configured local Skill directory cannot be loaded safely. */
export class LocalSkillDirectoryError extends AgentyxError {
  readonly directory: string;

  constructor(directory: string, reason: string, options?: ErrorOptions) {
    super(
      "local_skill_directory_error",
      `Could not load local Skill directory "${directory}": ${reason}`,
      options,
    );
    this.name = "LocalSkillDirectoryError";
    this.directory = directory;
  }
}
