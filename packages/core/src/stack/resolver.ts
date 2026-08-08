import { CircularStackDependencyError, UnknownStackError } from "./errors.js";
import { builtInStackRegistry, type StackRegistry } from "./registry.js";

/**
 * Expands the requested stacks into the full inheritance chain.
 *
 * The result is dependency-first, de-duplicated and deterministic: stacks are
 * visited in the order they are requested, and each stack's parents are visited
 * in declaration order before the stack itself.
 *
 * @throws {UnknownStackError} when a requested or inherited stack is missing.
 * @throws {CircularStackDependencyError} when inheritance forms a cycle.
 */
export function resolveStacks(
  requestedStacks: readonly string[],
  registry: StackRegistry = builtInStackRegistry,
): string[] {
  const resolved: string[] = [];
  const settled = new Set<string>();
  const path: string[] = [];

  const visit = (name: string, requiredBy: string | undefined): void => {
    if (settled.has(name)) {
      return;
    }

    const cycleStart = path.indexOf(name);

    if (cycleStart !== -1) {
      throw new CircularStackDependencyError([...path.slice(cycleStart), name]);
    }

    const definition = registry.get(name);

    if (definition === undefined) {
      throw new UnknownStackError(name, requiredBy, [...registry.keys()]);
    }

    path.push(name);

    for (const parent of definition.extends) {
      visit(parent, name);
    }

    path.pop();
    settled.add(name);
    resolved.push(name);
  };

  for (const name of requestedStacks) {
    visit(name, undefined);
  }

  return resolved;
}
