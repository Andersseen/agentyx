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
