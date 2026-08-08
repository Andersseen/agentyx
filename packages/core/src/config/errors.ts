import type { ZodError } from "zod";
import { AgnoxError } from "../errors.js";

/** A single configuration problem, addressed by its location in the document. */
export interface AgnoxConfigIssue {
  /** Dotted path to the offending value, or `(root)` for the document itself. */
  readonly path: string;
  readonly message: string;
}

/** Raised when the supplied directory has no `.agnox.json`. */
export class AgnoxConfigNotFoundError extends AgnoxError {
  readonly filePath: string;

  constructor(filePath: string, options?: ErrorOptions) {
    super("agnox_config_not_found", `Agnox configuration file not found: ${filePath}`, options);
    this.name = "AgnoxConfigNotFoundError";
    this.filePath = filePath;
  }
}

/** Raised when `.agnox.json` is not valid JSON. */
export class AgnoxConfigParseError extends AgnoxError {
  readonly filePath: string;

  constructor(filePath: string, reason: string, options?: ErrorOptions) {
    super("agnox_config_parse_error", `${filePath} is not valid JSON: ${reason}`, options);
    this.name = "AgnoxConfigParseError";
    this.filePath = filePath;
  }
}

/** Raised when the document parses as JSON but violates the Agnox schema. */
export class AgnoxConfigValidationError extends AgnoxError {
  readonly issues: readonly AgnoxConfigIssue[];
  /** The file the configuration came from, when it was read from disk. */
  readonly filePath: string | undefined;

  constructor(error: ZodError, filePath?: string) {
    const issues = toConfigIssues(error);
    const location = filePath === undefined ? "" : ` in ${filePath}`;
    const details = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");

    super("agnox_config_invalid", `Invalid Agnox configuration${location}:\n${details}`);
    this.name = "AgnoxConfigValidationError";
    this.issues = issues;
    this.filePath = filePath;
  }
}

function toConfigIssues(error: ZodError): readonly AgnoxConfigIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
  }));
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return "(root)";
  }

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }

    return formatted === "" ? String(segment) : `${formatted}.${String(segment)}`;
  }, "");
}
