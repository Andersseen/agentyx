import type { ZodError } from "zod";
import { AgnoxError } from "../errors.js";

export class UnknownMcpServerError extends AgnoxError {
  readonly serverName: string;
  readonly requiredBy: string | undefined;
  readonly knownServers: readonly string[];

  constructor(serverName: string, requiredBy: string | undefined, knownServers: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by stack "${requiredBy}")`;
    const known = knownServers.length > 0 ? [...knownServers].sort().join(", ") : "none";

    super(
      "unknown_mcp_server",
      `Unknown MCP server "${serverName}"${origin}. Known MCP servers: ${known}.`,
    );
    this.name = "UnknownMcpServerError";
    this.serverName = serverName;
    this.requiredBy = requiredBy;
    this.knownServers = knownServers;
  }
}

export class DuplicateMcpServerError extends AgnoxError {
  readonly serverName: string;

  constructor(serverName: string) {
    super("duplicate_mcp_server", `Duplicate MCP server definition: "${serverName}".`);
    this.name = "DuplicateMcpServerError";
    this.serverName = serverName;
  }
}

export class InvalidMcpServerError extends AgnoxError {
  readonly origin: string;
  readonly reason: string;

  constructor(origin: string, reason: string | ZodError, options?: ErrorOptions) {
    const detail = typeof reason === "string" ? reason : formatIssues(reason);

    super("invalid_mcp_server", `Invalid MCP server in ${origin}: ${detail}`, options);
    this.name = "InvalidMcpServerError";
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
