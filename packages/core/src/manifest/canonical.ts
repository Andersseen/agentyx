/**
 * Serialises validated JSON-compatible values with recursively sorted object keys.
 * Arrays retain their caller-provided order because some Agentyx arrays encode resolution order.
 */
export function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(sortObjectKeys(value));

  if (serialized === undefined) {
    throw new TypeError("Canonical JSON requires a JSON-compatible value.");
  }

  return serialized;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;

    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, sortObjectKeys(object[key])]),
    );
  }

  return value;
}
