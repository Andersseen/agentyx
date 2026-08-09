import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
} from "./errors.js";
import { type AgentyxConfig, agentyxConfigSchema } from "./schema.js";

export const AGENTYX_CONFIG_FILENAME = ".agentyx.json";

/** The absolute path `.agentyx.json` is read from for a given project. */
export function agentyxConfigPath(projectPath: string = process.cwd()): string {
  return resolve(projectPath, AGENTYX_CONFIG_FILENAME);
}

/**
 * Validates an already-parsed configuration document.
 *
 * @throws {AgentyxConfigValidationError} when the document violates the schema.
 */
export function parseAgentyxConfig(value: unknown, filePath?: string): AgentyxConfig {
  const result = agentyxConfigSchema.safeParse(value);

  if (!result.success) {
    throw new AgentyxConfigValidationError(result.error, filePath);
  }

  return result.data;
}

/**
 * Reads and validates `.agentyx.json` from `projectPath`.
 *
 * Parent directories are not searched, and invalid configurations are never
 * silently repaired.
 *
 * @throws {AgentyxConfigNotFoundError} when the file does not exist.
 * @throws {AgentyxConfigParseError} when the file is not valid JSON.
 * @throws {AgentyxConfigValidationError} when the document violates the schema.
 */
export async function loadAgentyxConfig(
  projectPath: string = process.cwd(),
): Promise<AgentyxConfig> {
  const filePath = agentyxConfigPath(projectPath);
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (cause) {
    if (isFileNotFound(cause)) {
      throw new AgentyxConfigNotFoundError(filePath, { cause });
    }

    throw cause;
  }

  let document: unknown;

  try {
    document = JSON.parse(contents);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new AgentyxConfigParseError(filePath, reason, { cause });
  }

  return parseAgentyxConfig(document, filePath);
}

function isFileNotFound(cause: unknown): boolean {
  return cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT";
}
