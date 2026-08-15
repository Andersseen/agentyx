import type { ZodError } from "zod";

/** A single problem in an Agentyx document, addressed by its location in it. */
export interface AgentyxIssue {
  /** Dotted path to the offending value, or `(root)` for the document itself. */
  readonly path: string;
  readonly message: string;
}

/**
 * Turns a Zod failure into locations a reader can find in the file.
 *
 * Shared by every document Agentyx validates, so a problem in `.agentyx.json`
 * and a problem in `.agentyx.lock.json` are reported the same way.
 */
export function toAgentyxIssues(error: ZodError): readonly AgentyxIssue[] {
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
