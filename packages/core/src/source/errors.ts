import { AgentyxError } from "../errors.js";

export class DuplicateTrustedSourceError extends AgentyxError {
  readonly sourceName: string;

  constructor(sourceName: string) {
    super("duplicate_trusted_source", `Duplicate trusted source "${sourceName}".`);
    this.name = "DuplicateTrustedSourceError";
    this.sourceName = sourceName;
  }
}

export class UnknownTrustedSourceError extends AgentyxError {
  readonly sourceName: string;
  readonly knownSources: readonly string[];

  constructor(sourceName: string, knownSources: readonly string[]) {
    const known = knownSources.length > 0 ? [...knownSources].sort().join(", ") : "none";

    super(
      "unknown_trusted_source",
      `Unknown trusted source "${sourceName}". Known trusted sources: ${known}.`,
    );
    this.name = "UnknownTrustedSourceError";
    this.sourceName = sourceName;
    this.knownSources = knownSources;
  }
}

export class TrustedSourceLoadError extends AgentyxError {
  readonly sourceName: string;

  constructor(sourceName: string, reason: string, options?: ErrorOptions) {
    super(
      "trusted_source_load_error",
      `Could not load trusted source "${sourceName}": ${reason}`,
      options,
    );
    this.name = "TrustedSourceLoadError";
    this.sourceName = sourceName;
  }
}
