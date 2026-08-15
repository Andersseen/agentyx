import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentyxManifestParseError, AgentyxManifestValidationError } from "./errors.js";
import {
  INSTALL_MANIFEST_VERSION,
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
  return { version: INSTALL_MANIFEST_VERSION, entries: [] };
}

/**
 * The SHA-256 digest Agentyx records for managed content.
 *
 * Comparing this digest with the file on disk is what separates "Agentyx wrote
 * this and may replace it" from "someone else owns this file", so it is
 * computed over the exact bytes written, never over a normalised form.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

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
  const filePath = agentyxManifestPath(projectPath);
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyInstallManifest();
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

  return parseInstallManifest(document, filePath);
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
    .map((entry) =>
      entry.kind === "skill"
        ? { ...entry, targets: sorted(entry.targets) }
        : { ...entry, targets: sorted(entry.targets), servers: sorted(entry.servers) },
    )
    .sort((left, right) => left.path.localeCompare(right.path));

  return `${JSON.stringify({ version: manifest.version, entries }, null, 2)}\n`;
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
