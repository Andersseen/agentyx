import type { ZodError } from "zod";
import { AgentyxError } from "../errors.js";

export class UnknownHookError extends AgentyxError {
  readonly hookName: string;
  readonly requiredBy: string | undefined;
  readonly knownHooks: readonly string[];

  constructor(hookName: string, requiredBy: string | undefined, knownHooks: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by "${requiredBy}")`;
    const known = knownHooks.length > 0 ? [...knownHooks].sort().join(", ") : "none";

    super("unknown_hook", `Unknown hook "${hookName}"${origin}. Known hooks: ${known}.`);
    this.name = "UnknownHookError";
    this.hookName = hookName;
    this.requiredBy = requiredBy;
    this.knownHooks = knownHooks;
  }
}

export class DuplicateHookError extends AgentyxError {
  readonly hookName: string;

  constructor(hookName: string) {
    super("duplicate_hook", `Duplicate hook definition: "${hookName}".`);
    this.name = "DuplicateHookError";
    this.hookName = hookName;
  }
}

export class InvalidHookError extends AgentyxError {
  readonly origin: string;
  readonly reason: string;

  constructor(origin: string, reason: string | ZodError, options?: ErrorOptions) {
    const detail = typeof reason === "string" ? reason : formatIssues(reason);

    super("invalid_hook", `Invalid hook in ${origin}: ${detail}`, options);
    this.name = "InvalidHookError";
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
