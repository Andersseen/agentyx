import { builtInStackRegistry, type StackRegistry } from "../stack/registry.js";
import { resolveStacks } from "../stack/resolver.js";
import type { AgnoxConfig, AgnoxProfile } from "./schema.js";

/** A project configuration with its stack inheritance expanded. */
export interface ResolvedAgnoxConfig {
  /** The stacks the project asked for, in configuration order. */
  readonly requestedStacks: readonly string[];
  /** The full inheritance chain, dependency-first and de-duplicated. */
  readonly resolvedStacks: readonly string[];
  readonly profile: AgnoxProfile;
  readonly targets: readonly string[];
}

/**
 * Combines a validated project configuration with stack resolution. The input
 * is never mutated.
 *
 * @throws {UnknownStackError} when a configured stack is missing.
 * @throws {CircularStackDependencyError} when inheritance forms a cycle.
 */
export function resolveAgnoxConfig(
  config: AgnoxConfig,
  registry: StackRegistry = builtInStackRegistry,
): ResolvedAgnoxConfig {
  const requestedStacks = [...config.extends];

  return {
    requestedStacks,
    resolvedStacks: resolveStacks(requestedStacks, registry),
    profile: config.profile,
    targets: [...config.targets],
  };
}
