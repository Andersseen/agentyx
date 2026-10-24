import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentyxManifestParseError, AgentyxManifestValidationError } from "./errors.js";
import type { ResolutionSnapshot } from "./resolution.js";
import {
  INSTALL_MANIFEST_V1_VERSION,
  type InstallManifest,
  type InstallManifestEntry,
  installManifestSchema,
} from "./schema.js";

export const AGENTYX_MANIFEST_FILENAME = ".agentyx.lock.json";

/** The absolute path `.agentyx.lock.json` is read from for a given project. */
export function agentyxManifestPath(projectPath: string = process.cwd()): string {
  return resolve(projectPath, AGENTYX_MANIFEST_FILENAME);
}

/** A manifest that claims nothing — what a project has before its first install. */
export function emptyInstallManifest(): InstallManifest {
  return { version: INSTALL_MANIFEST_V1_VERSION, entries: [] };
}

/**
 * The SHA-256 digest Agentyx records for managed content.
 *
 * Comparing this digest with the file on disk is what separates "Agentyx wrote
 * this and may replace it" from "someone else owns this file", so it is
 * computed over the exact bytes written, never over a normalised form.
 */
export { hashContent } from "./hashing.js";

/**
 * Validates an already-parsed manifest document.
 *
 * @throws {AgentyxManifestValidationError} when the document violates the schema.
 */
export function parseInstallManifest(value: unknown, filePath?: string): InstallManifest {
  const result = installManifestSchema.safeParse(value);

  if (!result.success) {
    throw new AgentyxManifestValidationError(result.error, filePath);
  }

  return result.data;
}

/**
 * Reads `.agentyx.lock.json` from `projectPath`.
 *
 * A missing manifest is a legitimate state — the project has simply never been
 * installed into — and yields an empty manifest. A manifest that exists but
 * cannot be understood is a hard failure: it governs which files Agentyx may
 * overwrite and delete, and a damaged one is never guessed at.
 *
 * @throws {AgentyxManifestParseError} when the file is not valid JSON.
 * @throws {AgentyxManifestValidationError} when the document violates the schema.
 */
export async function loadInstallManifest(
  projectPath: string = process.cwd(),
): Promise<InstallManifest> {
  return (await loadInstallManifestState(projectPath)).manifest;
}

/** The manifest plus whether a lock file actually exists on disk. */
export interface InstallManifestState {
  /** `false` only when `.agentyx.lock.json` is absent; `manifest` is then the empty v1 manifest. */
  readonly present: boolean;
  readonly manifest: InstallManifest;
}

/**
 * Like `loadInstallManifest`, but tells a missing lock apart from an existing one.
 *
 * Orchestration needs the difference: a missing lock may start a fresh version-2 record,
 * while an existing version-1 lock requires an explicit migration.
 *
 * @throws {AgentyxManifestParseError} when the file is not valid JSON.
 * @throws {AgentyxManifestValidationError} when the document violates the schema.
 */
export async function loadInstallManifestState(
  projectPath: string = process.cwd(),
): Promise<InstallManifestState> {
  const filePath = agentyxManifestPath(projectPath);
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return { present: false, manifest: emptyInstallManifest() };
    }

    throw cause;
  }

  let document: unknown;

  try {
    document = JSON.parse(contents);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new AgentyxManifestParseError(filePath, reason, { cause });
  }

  return { present: true, manifest: parseInstallManifest(document, filePath) };
}

/**
 * Serialises a manifest for writing.
 *
 * Entries and their lists are sorted so that reinstalling an unchanged project
 * produces a byte-identical file and the manifest never shows up as noise in a
 * diff. Writing is deliberately not done here — only the install executor
 * touches the filesystem.
 */
export function formatInstallManifest(manifest: InstallManifest): string {
  const entries = [...manifest.entries]
    .map((entry) => {
      if (entry.kind === "skill") {
        return { ...entry, targets: sorted(entry.targets) };
      }

      if (entry.kind === "mcp") {
        return { ...entry, targets: sorted(entry.targets), servers: sorted(entry.servers) };
      }

      if (entry.kind === "settings") {
        return {
          ...entry,
          targets: sorted(entry.targets),
          servers: sorted(entry.servers),
          hooks: sorted(entry.hooks),
        };
      }

      if (entry.kind === "agent") {
        return { ...entry, targets: sorted(entry.targets) };
      }

      return { ...entry, targets: sorted(entry.targets), hooks: sorted(entry.hooks) };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const document =
    manifest.version === INSTALL_MANIFEST_V1_VERSION
      ? { version: manifest.version, entries }
      : {
          version: manifest.version,
          entries,
          resolution: formatResolutionSnapshot(manifest.resolution),
        };

  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Indexes manifest entries by managed path.
 *
 * Every ownership question — may this file be overwritten, may it be deleted —
 * is a lookup by path, so callers do not scan the list themselves.
 */
export function manifestEntriesByPath(
  manifest: InstallManifest,
): ReadonlyMap<string, InstallManifestEntry> {
  return new Map(manifest.entries.map((entry) => [entry.path, entry]));
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function formatResolutionSnapshot(
  resolution: ResolutionSnapshot | null,
): ResolutionSnapshot | null {
  if (resolution === null) return null;

  return {
    agentyxVersion: resolution.agentyxVersion,
    configHash: resolution.configHash,
    targets: sorted(resolution.targets),
    skills: resolution.skills.map(formatResolutionCapability),
    mcpServers: resolution.mcpServers.map(formatResolutionCapability),
    tools: resolution.tools.map(formatResolutionCapability),
    hooks: resolution.hooks.map(formatResolutionCapability),
    agents: resolution.agents.map(formatResolutionCapability),
  };
}

function formatResolutionCapability<T extends ResolutionSnapshot["skills"][number]>(
  capability: T,
): T {
  return {
    ...capability,
    origins: capability.origins.map((origin) =>
      origin.kind === "pack" ? { kind: origin.kind, name: origin.name } : { kind: origin.kind },
    ),
  } as T;
}
