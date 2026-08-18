import { builtInMcpServerRegistry } from "../mcp/built-in.js";
import type { McpServerRegistry } from "../mcp/registry.js";
import { collectPackMcpServerReferences, filterEffectiveMcpServers } from "../mcp/resolver.js";
import type { McpServerReference } from "../mcp/schema.js";
import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInSkillRegistry } from "../skill/built-in.js";
import type { SkillRegistry } from "../skill/registry.js";
import { collectPackSkills } from "../skill/resolver.js";
import { builtInToolRegistry } from "../tool/built-in.js";
import type { ToolRegistry } from "../tool/registry.js";
import { collectPackToolReferences, filterEffectiveTools } from "../tool/resolver.js";
import type { ToolReference } from "../tool/schema.js";
import { UnknownEnabledCapabilityError } from "./errors.js";
import type { AgentyxConfig } from "./schema.js";

/** A project configuration with its selected packs resolved. */
export interface ResolvedAgentyxConfig {
  /** The packs the project asked for, in configuration order. */
  readonly requestedPacks: readonly string[];
  /** Selected packs, de-duplicated while preserving configuration order. */
  readonly resolvedPacks: readonly string[];
  /**
   * Skill identifiers contributed by the resolved packs, in resolution order.
   * Identifiers only — reading the instructions is a separate, explicit step.
   */
  readonly skills: readonly string[];
  readonly declaredMcpServers: readonly McpServerReference[];
  readonly mcpServers: readonly string[];
  readonly declaredTools: readonly ToolReference[];
  readonly tools: readonly string[];
  readonly enabled: readonly string[];
  readonly targets: readonly string[];
}

/**
 * Combines a validated project configuration with pack and skill resolution.
 * The input is never mutated.
 *
 * @throws {UnknownPackError} when a configured pack is missing.
 * @throws {UnknownSkillError} when a pack references an unknown skill.
 */
export function resolveAgentyxConfig(
  config: AgentyxConfig,
  registry: PackRegistry = builtInPackRegistry,
  skillRegistry: SkillRegistry = builtInSkillRegistry,
  mcpRegistry: McpServerRegistry = builtInMcpServerRegistry,
  toolRegistry: ToolRegistry = builtInToolRegistry,
): ResolvedAgentyxConfig {
  const requestedPacks = [...config.packs];
  const resolvedPacks = resolvePacks(requestedPacks, registry);
  const declaredMcpServers = collectPackMcpServerReferences(resolvedPacks, registry, mcpRegistry);
  const declaredTools = collectPackToolReferences(resolvedPacks, registry, toolRegistry);
  const knownOptionalCapabilities = [
    ...declaredMcpServers
      .filter((server) => server.activation === "optional")
      .map((server) => server.name),
    ...declaredTools.filter((tool) => tool.activation === "optional").map((tool) => tool.name),
  ];

  for (const capability of config.enable) {
    if (!knownOptionalCapabilities.includes(capability)) {
      throw new UnknownEnabledCapabilityError(capability, knownOptionalCapabilities);
    }
  }

  return {
    requestedPacks,
    resolvedPacks,
    skills: collectPackSkills(resolvedPacks, registry, skillRegistry),
    declaredMcpServers,
    mcpServers: filterEffectiveMcpServers(declaredMcpServers, config.enable),
    declaredTools,
    tools: filterEffectiveTools(declaredTools, config.enable),
    enabled: [...config.enable],
    targets: [...config.targets],
  };
}
