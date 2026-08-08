import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgnoxConfigNotFoundError,
  AgnoxConfigParseError,
  AgnoxConfigValidationError,
} from "./errors.js";
import { type AgnoxConfig, agnoxConfigSchema } from "./schema.js";

export const AGNOX_CONFIG_FILENAME = ".agnox.json";

/** The absolute path `.agnox.json` is read from for a given project. */
export function agnoxConfigPath(projectPath: string = process.cwd()): string {
  return resolve(projectPath, AGNOX_CONFIG_FILENAME);
}

/**
 * Validates an already-parsed configuration document.
 *
 * @throws {AgnoxConfigValidationError} when the document violates the schema.
 */
export function parseAgnoxConfig(value: unknown, filePath?: string): AgnoxConfig {
  const result = agnoxConfigSchema.safeParse(value);

  if (!result.success) {
    throw new AgnoxConfigValidationError(result.error, filePath);
  }

  return result.data;
}

/**
 * Reads and validates `.agnox.json` from `projectPath`.
 *
 * Parent directories are not searched, and invalid configurations are never
 * silently repaired.
 *
 * @throws {AgnoxConfigNotFoundError} when the file does not exist.
 * @throws {AgnoxConfigParseError} when the file is not valid JSON.
 * @throws {AgnoxConfigValidationError} when the document violates the schema.
 */
export async function loadAgnoxConfig(projectPath: string = process.cwd()): Promise<AgnoxConfig> {
  const filePath = agnoxConfigPath(projectPath);
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (cause) {
    if (isFileNotFound(cause)) {
      throw new AgnoxConfigNotFoundError(filePath, { cause });
    }

    throw cause;
  }

  let document: unknown;

  try {
    document = JSON.parse(contents);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new AgnoxConfigParseError(filePath, reason, { cause });
  }

  return parseAgnoxConfig(document, filePath);
}

function isFileNotFound(cause: unknown): boolean {
  return cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT";
}
