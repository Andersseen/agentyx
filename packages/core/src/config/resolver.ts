import { builtInAgentRegistry } from "../agent/built-in.js";
import type { AgentRegistry } from "../agent/registry.js";
import { collectPackAgentReferences, filterEffectiveAgents } from "../agent/resolver.js";
import type { AgentReference } from "../agent/schema.js";
import { builtInHookRegistry } from "../hook/built-in.js";
import type { HookRegistry } from "../hook/registry.js";
import { collectPackHookReferences, filterEffectiveHooks } from "../hook/resolver.js";
import type { HookReference } from "../hook/schema.js";
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
import {
  ContradictoryCapabilitySelectionError,
  UnknownEnabledCapabilityError,
  UnknownExcludedCapabilityError,
} from "./errors.js";
import type { AgentyxConfig, CapabilityExclusions } from "./schema.js";

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
  readonly declaredHooks: readonly HookReference[];
  readonly hooks: readonly string[];
  readonly declaredAgents: readonly AgentReference[];
  readonly agents: readonly string[];
  readonly enabled: readonly string[];
  readonly excluded: CapabilityExclusions;
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
  hookRegistry: HookRegistry = builtInHookRegistry,
  agentRegistry: AgentRegistry = builtInAgentRegistry,
): ResolvedAgentyxConfig {
  const requestedPacks = [...config.packs];
  const resolvedPacks = resolvePacks(requestedPacks, registry);
  const declaredMcpServers = collectPackMcpServerReferences(resolvedPacks, registry, mcpRegistry);
  const declaredTools = collectPackToolReferences(resolvedPacks, registry, toolRegistry);
  const declaredHooks = collectPackHookReferences(resolvedPacks, registry, hookRegistry);
  const declaredAgents = collectPackAgentReferences(resolvedPacks, registry, agentRegistry);
  const declaredSkills = collectPackSkills(resolvedPacks, registry, skillRegistry);
  const excluded = normalizeExclusions(config.exclude);
  const declaredByKind = {
    skills: new Set(declaredSkills),
    mcpServers: new Set(declaredMcpServers.map((item) => item.name)),
    tools: new Set(declaredTools.map((item) => item.name)),
    hooks: new Set(declaredHooks.map((item) => item.name)),
    agents: new Set(declaredAgents.map((item) => item.name)),
  } as const;

  for (const [kind, names] of Object.entries(excluded) as [
    keyof CapabilityExclusions,
    readonly string[],
  ][]) {
    for (const name of names) {
      if (!declaredByKind[kind].has(name)) {
        throw new UnknownExcludedCapabilityError(kind, name);
      }
    }
  }
  const knownOptionalCapabilities = [
    ...declaredMcpServers
      .filter((server) => server.activation === "optional")
      .map((server) => server.name),
    ...declaredTools.filter((tool) => tool.activation === "optional").map((tool) => tool.name),
    ...declaredHooks.filter((hook) => hook.activation === "optional").map((hook) => hook.name),
    ...declaredAgents.filter((agent) => agent.activation === "optional").map((agent) => agent.name),
  ];

  for (const capability of config.enable) {
    if (!knownOptionalCapabilities.includes(capability)) {
      throw new UnknownEnabledCapabilityError(capability, knownOptionalCapabilities);
    }
  }

  for (const [kind, names] of Object.entries(excluded) as [
    keyof CapabilityExclusions,
    readonly string[],
  ][]) {
    if (kind === "skills") continue;
    for (const name of names) {
      if (config.enable.includes(name)) {
        throw new ContradictoryCapabilitySelectionError(name);
      }
    }
  }

  return {
    requestedPacks,
    resolvedPacks,
    skills: unique([
      ...declaredSkills.filter((name) => !excluded.skills.includes(name)),
      ...(config.project !== undefined ||
      (config.relations?.length ?? 0) > 0 ||
      hasProjectContext(config.context)
        ? ["agentyx-project-context"]
        : []),
    ]),
    declaredMcpServers,
    mcpServers: filterEffectiveMcpServers(declaredMcpServers, config.enable, excluded.mcpServers),
    declaredTools,
    tools: filterEffectiveTools(declaredTools, config.enable, excluded.tools),
    declaredHooks,
    hooks: filterEffectiveHooks(declaredHooks, config.enable, excluded.hooks),
    declaredAgents,
    agents: filterEffectiveAgents(declaredAgents, config.enable, excluded.agents),
    enabled: [...config.enable],
    excluded,
    targets: [...config.targets],
  };
}

function normalizeExclusions(exclusions: AgentyxConfig["exclude"]): CapabilityExclusions {
  return {
    skills: unique(exclusions?.skills ?? []),
    mcpServers: unique(exclusions?.mcpServers ?? []),
    tools: unique(exclusions?.tools ?? []),
    hooks: unique(exclusions?.hooks ?? []),
    agents: unique(exclusions?.agents ?? []),
  };
}

function hasProjectContext(context: AgentyxConfig["context"]): boolean {
  return (
    context !== undefined &&
    (Object.keys(context.commands).length > 0 ||
      context.areas.length > 0 ||
      context.constraints.length > 0)
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
