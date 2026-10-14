import { AgentyxError } from "@agentyx/core";

/**
 * Raised when a target has no adapter.
 *
 * `targets` in `.agentyx.json` is an open list of strings, so this is the failure
 * a user sees for a provider Agentyx cannot install into yet.
 */
export class UnknownAdapterError extends AgentyxError {
  readonly target: string;
  readonly knownTargets: readonly string[];

  constructor(target: string, knownTargets: readonly string[]) {
    const known = knownTargets.length > 0 ? [...knownTargets].sort().join(", ") : "none";

    super("unknown_adapter", `Unknown target "${target}". Known targets: ${known}.`);
    this.name = "UnknownAdapterError";
    this.target = target;
    this.knownTargets = knownTargets;
  }
}

/** Raised when a registry is built from adapters that reuse an id. */
export class DuplicateAdapterError extends AgentyxError {
  readonly adapterId: string;

  constructor(adapterId: string) {
    super("duplicate_adapter", `Duplicate adapter: "${adapterId}".`);
    this.name = "DuplicateAdapterError";
    this.adapterId = adapterId;
  }
}

export class InvalidAdapterConfigurationError extends AgentyxError {
  constructor(adapterId: string, detail: string) {
    super("invalid_adapter_configuration", `Adapter "${adapterId}" is invalid: ${detail}`);
    this.name = "InvalidAdapterConfigurationError";
  }
}

/** Raised when an installation is asked for without saying where it should go. */
export class MissingInstallTargetsError extends AgentyxError {
  constructor() {
    super(
      "missing_install_targets",
      'No install targets. Add "targets" to .agentyx.json, or name one explicitly.',
    );
    this.name = "MissingInstallTargetsError";
  }
}

/**
 * Raised when a planned write would land outside the directory Agentyx owns for a
 * target.
 *
 * Agentyx only ever manages its own skill directories, so this is a hard failure
 * rather than something to clamp or repair — it means an adapter produced a
 * path it had no business producing.
 */
export class InstallPathError extends AgentyxError {
  readonly path: string;
  readonly root: string;

  constructor(path: string, root: string) {
    super("install_path_escape", `Refusing to write ${path}: it is outside ${root}.`);
    this.name = "InstallPathError";
    this.path = path;
    this.root = root;
  }
}

export class ProviderConfigParseError extends AgentyxError {
  readonly path: string;

  constructor(path: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);

    super("provider_config_parse_error", `Could not parse ${path}: ${detail}`, {
      cause,
    });
    this.name = "ProviderConfigParseError";
    this.path = path;
  }
}

/**
 * Raised when installing would touch a file Agentyx does not own.
 *
 * Either the file was there before Agentyx ever ran, or a file Agentyx wrote has
 * been edited since. Both mean someone else's work is at the destination, and
 * an installer that overwrites it silently is one that cannot be trusted with a
 * shared directory such as `.agents/skills`. Nothing is written when this is
 * raised.
 */
export class InstallConflictError extends AgentyxError {
  readonly paths: readonly string[];

  constructor(paths: readonly string[]) {
    const list = [...paths].sort().map((path) => `  - ${path}`);

    super(
      "install_conflict",
      [
        `Refusing to overwrite ${paths.length} file(s) Agentyx does not manage:`,
        ...list,
        "Move or delete them, or re-run with --force to overwrite. Nothing was written.",
      ].join("\n"),
    );
    this.name = "InstallConflictError";
    this.paths = paths;
  }
}

export class SharedInstallConflictError extends AgentyxError {
  readonly path: string;
  readonly targets: readonly string[];

  constructor(path: string, targets: readonly string[]) {
    super(
      "shared_install_conflict",
      `Conflicting install content for ${path} requested by targets: ${[...targets].sort().join(", ")}.`,
    );
    this.name = "SharedInstallConflictError";
    this.path = path;
    this.targets = targets;
  }
}

/** Raised when a resolved MCP server uses a transport the target provider does not declare. */
export class UnsupportedMcpTransportError extends AgentyxError {
  readonly adapterId: string;
  readonly server: string;
  readonly transport: string;

  constructor(adapterId: string, server: string, transport: string) {
    super(
      "unsupported_mcp_transport",
      `MCP server "${server}" uses the ${transport} transport, which "${adapterId}" does not support.`,
    );
    this.name = "UnsupportedMcpTransportError";
    this.adapterId = adapterId;
    this.server = server;
    this.transport = transport;
  }
}

/**
 * Raised when an environment reference cannot be expressed in a provider's documented MCP format
 * without writing a wrong literal value.
 */
export class UnsupportedMcpEnvReferenceError extends AgentyxError {
  readonly adapterId: string;
  readonly server: string;

  constructor(adapterId: string, server: string, detail: string) {
    super(
      "unsupported_mcp_env_reference",
      `MCP server "${server}" cannot be rendered for "${adapterId}": ${detail}`,
    );
    this.name = "UnsupportedMcpEnvReferenceError";
    this.adapterId = adapterId;
    this.server = server;
  }
}

/**
 * Raised when a destination no longer matches what the plan observed.
 *
 * A plan authorizes a mutation only against the exact state it saw, so a file
 * created, edited, replaced or removed since planning is left alone — `--force`
 * included. When this is raised before the first write, nothing was changed.
 */
export class StaleInstallPlanError extends AgentyxError {
  readonly paths: readonly string[];

  constructor(paths: readonly string[]) {
    const list = [...paths].sort().map((path) => `  - ${path}`);

    super(
      "stale_install_plan",
      [
        `The install plan is stale: ${paths.length} destination(s) changed after it was planned:`,
        ...list,
        "Nothing at these paths was overwritten. Re-run the command to plan against the current state.",
      ].join("\n"),
    );
    this.name = "StaleInstallPlanError";
    this.paths = paths;
  }
}

/**
 * Raised when an install stopped after it had already changed the project.
 *
 * Agentyx does not roll back: earlier changes stay in place, and the lock file
 * was not committed, so the previous lock remains the record of what Agentyx
 * owns. Paths are project-relative; neither file contents nor the underlying
 * system message are included.
 */
export class IncompleteInstallError extends AgentyxError {
  readonly completed: readonly string[];
  readonly pending: readonly string[];
  readonly reason: string;

  constructor(completed: readonly string[], pending: readonly string[], cause: unknown) {
    const reason = describeFailure(cause);
    const list = (title: string, paths: readonly string[]) => [
      title,
      ...(paths.length > 0 ? paths.map((path) => `  - ${path}`) : ["  (none)"]),
    ];

    super(
      "incomplete_install",
      [
        `The install was only partially applied: ${reason}`,
        ...list("Completed:", completed),
        ...list("Not applied:", pending),
        ".agentyx.lock.json was not updated, so files written above are not recorded as Agentyx-owned.",
        "Nothing was rolled back. Run `agentyx doctor`, review the paths above, resolve any conflict, then re-run.",
      ].join("\n"),
      { cause },
    );
    this.name = "IncompleteInstallError";
    this.completed = completed;
    this.pending = pending;
    this.reason = reason;
  }
}

function describeFailure(cause: unknown): string {
  if (cause instanceof StaleInstallPlanError) {
    return `a destination changed after planning (${cause.paths.join(", ")}).`;
  }

  if (cause instanceof InstallPathError) {
    return "a destination resolved outside the directory Agentyx owns.";
  }

  if (cause instanceof AgentyxError) {
    return `${cause.code}.`;
  }

  const code = cause instanceof Error ? (cause as NodeJS.ErrnoException).code : undefined;

  return code === undefined
    ? "a filesystem operation failed."
    : `a filesystem operation failed (${code}).`;
}
