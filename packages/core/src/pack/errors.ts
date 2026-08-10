import { AgentyxError } from "../errors.js";

/** Raised when a requested pack is not present in the registry. */
export class UnknownPackError extends AgentyxError {
  readonly packName: string;
  readonly requiredBy: string | undefined;
  readonly knownPacks: readonly string[];

  constructor(packName: string, requiredBy: string | undefined, knownPacks: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by "${requiredBy}")`;
    const known = knownPacks.length > 0 ? [...knownPacks].sort().join(", ") : "none";

    super("unknown_pack", `Unknown pack "${packName}"${origin}. Known packs: ${known}.`);
    this.name = "UnknownPackError";
    this.packName = packName;
    this.requiredBy = requiredBy;
    this.knownPacks = knownPacks;
  }
}

/** @deprecated Packs no longer inherit from other packs. */
export class CircularPackDependencyError extends AgentyxError {
  /** The cycle path, starting and ending with the same pack. */
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super("circular_pack_dependency", `Circular pack dependency: ${cycle.join(" -> ")}.`);
    this.name = "CircularPackDependencyError";
    this.cycle = cycle;
  }
}

/** Raised when a registry is built from definitions that reuse a pack name. */
export class DuplicatePackError extends AgentyxError {
  readonly packName: string;

  constructor(packName: string) {
    super("duplicate_pack", `Duplicate pack definition: "${packName}".`);
    this.name = "DuplicatePackError";
    this.packName = packName;
  }
}
