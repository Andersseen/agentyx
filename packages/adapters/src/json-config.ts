import { ProviderConfigParseError } from "./errors.js";

/** Shared by every provider config renderer that reads and writes plain JSON. */
export type JsonRecord = Record<string, unknown>;

export function parseJsonObject(content: string | undefined, path: string): JsonRecord {
  if (content === undefined) {
    return {};
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (!isRecord(parsed)) {
      throw new Error("expected a JSON object");
    }

    return parsed;
  } catch (cause) {
    throw new ProviderConfigParseError(path, cause);
  }
}

export function optionalRecord(value: unknown, path: string, field: string): JsonRecord {
  if (value === undefined) {
    return {};
  }

  if (isRecord(value)) {
    return value;
  }

  throw new ProviderConfigParseError(path, new Error(`${field} must be an object`));
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sortRecord(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, isRecord(value) ? sortRecord(value) : value]),
  );
}
