import { AgentyxError } from "../errors.js";

export class UnknownAgentError extends AgentyxError {
  constructor(name: string, pack?: string) {
    super(
      "unknown_agent",
      `Unknown agent "${name}"${pack ? ` referenced by pack "${pack}"` : ""}.`,
    );
    this.name = "UnknownAgentError";
  }
}
export class InvalidAgentError extends AgentyxError {
  constructor(name: string, reason: unknown) {
    super("invalid_agent", `Invalid agent "${name}": ${String(reason)}`);
    this.name = "InvalidAgentError";
  }
}
export class DuplicateAgentError extends AgentyxError {
  constructor(name: string) {
    super("duplicate_agent", `Duplicate agent definition "${name}".`);
    this.name = "DuplicateAgentError";
  }
}
