import { AgnoxError } from "@agnox/core";

/**
 * Raised when a target has no adapter.
 *
 * `targets` in `.agnox.json` is an open list of strings, so this is the failure
 * a user sees for a provider Agnox cannot install into yet.
 */
export class UnknownAdapterError extends AgnoxError {
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
export class DuplicateAdapterError extends AgnoxError {
  readonly adapterId: string;

  constructor(adapterId: string) {
    super("duplicate_adapter", `Duplicate adapter: "${adapterId}".`);
    this.name = "DuplicateAdapterError";
    this.adapterId = adapterId;
  }
}

/** Raised when an installation is asked for without saying where it should go. */
export class MissingInstallTargetsError extends AgnoxError {
  constructor() {
    super(
      "missing_install_targets",
      'No install targets. Add "targets" to .agnox.json, or name one explicitly.',
    );
    this.name = "MissingInstallTargetsError";
  }
}

/**
 * Raised when a planned write would land outside the directory Agnox owns for a
 * target.
 *
 * Agnox only ever manages its own skill directories, so this is a hard failure
 * rather than something to clamp or repair — it means an adapter produced a
 * path it had no business producing.
 */
export class InstallPathError extends AgnoxError {
  readonly path: string;
  readonly root: string;

  constructor(path: string, root: string) {
    super("install_path_escape", `Refusing to write ${path}: it is outside ${root}.`);
    this.name = "InstallPathError";
    this.path = path;
    this.root = root;
  }
}

export class ProviderConfigParseError extends AgnoxError {
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
