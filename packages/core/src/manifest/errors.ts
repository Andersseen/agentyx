import type { ZodError } from "zod";
import { AgentyxError } from "../errors.js";
import { type AgentyxIssue, toAgentyxIssues } from "../issues.js";

/** Raised when `.agentyx.lock.json` is not valid JSON. */
export class AgentyxManifestParseError extends AgentyxError {
  readonly filePath: string;

  constructor(filePath: string, reason: string, options?: ErrorOptions) {
    super("agentyx_manifest_parse_error", `${filePath} is not valid JSON: ${reason}`, options);
    this.name = "AgentyxManifestParseError";
    this.filePath = filePath;
  }
}

/**
 * Raised when the manifest parses as JSON but is not a manifest Agentyx
 * understands.
 *
 * This is never repaired. The manifest is what tells Agentyx which files it is
 * allowed to overwrite and delete, so guessing at a damaged one would be
 * guessing about destructive operations.
 */
export class AgentyxManifestValidationError extends AgentyxError {
  readonly issues: readonly AgentyxIssue[];
  readonly filePath: string | undefined;

  constructor(error: ZodError, filePath?: string) {
    const issues = toAgentyxIssues(error);
    const location = filePath === undefined ? "" : ` in ${filePath}`;
    const details = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");

    super(
      "agentyx_manifest_invalid",
      `Invalid Agentyx install manifest${location}:\n${details}\nDelete the file to start from a clean install record.`,
    );
    this.name = "AgentyxManifestValidationError";
    this.issues = issues;
    this.filePath = filePath;
  }
}
