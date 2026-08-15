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
