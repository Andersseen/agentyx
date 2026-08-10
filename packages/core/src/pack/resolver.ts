import { UnknownPackError } from "./errors.js";
import { builtInPackRegistry, type PackRegistry } from "./registry.js";

/**
 * Resolves selected packs without hidden inheritance.
 *
 * The result preserves configured order, removes duplicates by first
 * occurrence, and validates every requested pack.
 *
 * @throws {UnknownPackError} when a requested pack is missing.
 */
export function resolvePacks(
  requestedPacks: readonly string[],
  registry: PackRegistry = builtInPackRegistry,
): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const name of requestedPacks) {
    if (seen.has(name)) {
      continue;
    }

    if (!registry.has(name)) {
      throw new UnknownPackError(name, undefined, [...registry.keys()]);
    }

    seen.add(name);
    resolved.push(name);
  }

  return resolved;
}
