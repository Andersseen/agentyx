import { AgentyxError } from "../errors.js";

export class UnknownToolError extends AgentyxError {
  readonly toolName: string;
  readonly requiredBy: string | undefined;
  readonly knownTools: readonly string[];

  constructor(toolName: string, requiredBy: string | undefined, knownTools: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by "${requiredBy}")`;
    const known = knownTools.length > 0 ? [...knownTools].sort().join(", ") : "none";

    super("unknown_tool", `Unknown tool "${toolName}"${origin}. Known tools: ${known}.`);
    this.name = "UnknownToolError";
    this.toolName = toolName;
    this.requiredBy = requiredBy;
    this.knownTools = knownTools;
  }
}

export class DuplicateToolError extends AgentyxError {
  readonly toolName: string;

  constructor(toolName: string) {
    super("duplicate_tool", `Duplicate tool definition: "${toolName}".`);
    this.name = "DuplicateToolError";
    this.toolName = toolName;
  }
}

export class InvalidToolError extends AgentyxError {
  constructor(origin: string, reason: unknown, options?: ErrorOptions) {
    const message = reason instanceof Error ? reason.message : String(reason);

    super("invalid_tool", `Invalid ${origin}: ${message}.`, options);
    this.name = "InvalidToolError";
  }
}
