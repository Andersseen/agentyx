import { builtInMcpServerRegistry } from "../mcp/built-in.js";
import type { McpServerRegistry } from "../mcp/registry.js";
import { collectStackMcpServerReferences, filterEffectiveMcpServers } from "../mcp/resolver.js";
import type { McpServerReference } from "../mcp/schema.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import type { SkillRegistry } from "../skill/registry.js";
import { collectStackSkills } from "../skill/resolver.js";
import { builtInStackRegistry, type StackRegistry } from "../stack/registry.js";
import { resolveStacks } from "../stack/resolver.js";
import type { AgnoxConfig, AgnoxProfile } from "./schema.js";

/** A project configuration with its stack inheritance expanded. */
export interface ResolvedAgnoxConfig {
  /** The stacks the project asked for, in configuration order. */
  readonly requestedStacks: readonly string[];
  /** The full inheritance chain, dependency-first and de-duplicated. */
  readonly resolvedStacks: readonly string[];
  /**
   * Skill identifiers contributed by the resolved stacks, in resolution order.
   * Identifiers only — reading the instructions is a separate, explicit step.
   */
  readonly skills: readonly string[];
  readonly declaredMcpServers: readonly McpServerReference[];
  readonly mcpServers: readonly string[];
  readonly profile: AgnoxProfile;
  readonly targets: readonly string[];
}

/**
 * Combines a validated project configuration with stack and skill resolution.
 * The input is never mutated.
 *
 * @throws {UnknownStackError} when a configured stack is missing.
 * @throws {CircularStackDependencyError} when inheritance forms a cycle.
 * @throws {UnknownSkillError} when a stack references an unknown skill.
 */
export function resolveAgnoxConfig(
  config: AgnoxConfig,
  registry: StackRegistry = builtInStackRegistry,
  skillRegistry: SkillRegistry = builtInSkillRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
): ResolvedAgnoxConfig {
  const requestedStacks = [...config.extends];
  const resolvedStacks = resolveStacks(requestedStacks, registry);
  const declaredMcpServers = collectStackMcpServerReferences(resolvedStacks, registry, mcpRegistry);

  return {
    requestedStacks,
    resolvedStacks,
    skills: collectStackSkills(resolvedStacks, registry, skillRegistry),
    declaredMcpServers,
    mcpServers: filterEffectiveMcpServers(declaredMcpServers, config.profile),
    profile: config.profile,
    targets: [...config.targets],
  };
}
