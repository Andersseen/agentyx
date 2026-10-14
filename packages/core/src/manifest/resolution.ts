import { z } from "zod";
import type { AgentRegistry } from "../agent/registry.js";
import { type ResolutionOrigin, resolutionOriginSchema } from "../config/explain.js";
import type { ResolvedAgentyxConfig } from "../config/resolver.js";
import type { AgentyxConfig } from "../config/schema.js";
import { type CapabilityKind, deriveCapabilityProvenance } from "../harness/provenance.js";
import type { HookRegistry } from "../hook/registry.js";
import type { McpServerRegistry } from "../mcp/registry.js";
import type { PackRegistry } from "../pack/registry.js";
import { formatSkillMarkdown } from "../skill/markdown.js";
import type { SkillRegistry } from "../skill/registry.js";
import type { ToolRegistry } from "../tool/registry.js";
import { canonicalJson } from "./canonical.js";
import { contentHashSchema, hashContent } from "./hashing.js";

const resolutionCapabilitySchema = z.strictObject({
  name: z.string().min(1),
  hash: contentHashSchema,
  origins: z.array(resolutionOriginSchema).min(1),
});

/** The complete provider-neutral harness reviewed for a v2 lock. */
export const resolutionSnapshotSchema = z.strictObject({
  agentyxVersion: z.string().min(1),
  configHash: contentHashSchema,
  targets: z.array(z.string().min(1)),
  skills: z.array(resolutionCapabilitySchema),
  mcpServers: z.array(resolutionCapabilitySchema),
  tools: z.array(resolutionCapabilitySchema),
  hooks: z.array(resolutionCapabilitySchema),
  agents: z.array(resolutionCapabilitySchema),
});

export type ResolutionCapability = z.infer<typeof resolutionCapabilitySchema>;
export type ResolutionSnapshot = z.infer<typeof resolutionSnapshotSchema>;

export interface ResolutionSnapshotInput {
  readonly agentyxVersion: string;
  readonly config: AgentyxConfig;
  readonly resolved: ResolvedAgentyxConfig;
  readonly packRegistry: PackRegistry;
  readonly skillRegistry: SkillRegistry;
  readonly mcpRegistry: McpServerRegistry;
  readonly toolRegistry: ToolRegistry;
  readonly hookRegistry: HookRegistry;
  readonly agentRegistry: AgentRegistry;
}

export const RESOLUTION_DIFFERENCE_KINDS = [
  "agentyx-version",
  "config",
  "targets",
  "skill",
  "mcp",
  "tool",
  "hook",
  "agent",
] as const;

export const resolutionDifferenceSchema = z.strictObject({
  kind: z.enum(RESOLUTION_DIFFERENCE_KINDS),
  name: z.string().min(1).optional(),
  change: z.enum(["added", "removed", "changed"]).optional(),
});

export type ResolutionDifference = z.infer<typeof resolutionDifferenceSchema>;

/** Creates a deterministic snapshot from one already-resolved project harness. */
export function createResolutionSnapshot(input: ResolutionSnapshotInput): ResolutionSnapshot {
  const provenance = capabilityOrigins(input.resolved, input.packRegistry);

  return resolutionSnapshotSchema.parse({
    agentyxVersion: input.agentyxVersion,
    configHash: hashContent(canonicalJson(canonicalConfig(input.config))),
    targets: sortedUnique(input.resolved.targets),
    skills: input.resolved.skills.map((name) =>
      snapshotCapability("skill", name, provenance, () => hashSkill(input.skillRegistry, name)),
    ),
    mcpServers: input.resolved.mcpServers.map((name) =>
      snapshotCapability("mcp", name, provenance, () =>
        hashDefinition(input.mcpRegistry.get(name)),
      ),
    ),
    tools: input.resolved.tools.map((name) =>
      snapshotCapability("tool", name, provenance, () =>
        hashDefinition(input.toolRegistry.get(name)),
      ),
    ),
    hooks: input.resolved.hooks.map((name) =>
      snapshotCapability("hook", name, provenance, () =>
        hashDefinition(input.hookRegistry.get(name)),
      ),
    ),
    agents: input.resolved.agents.map((name) =>
      snapshotCapability("agent", name, provenance, () =>
        hashDefinition(input.agentRegistry.get(name)),
      ),
    ),
  });
}

/** Compares reviewed snapshots without returning instruction bodies, definitions or secrets. */
export function compareResolutionSnapshots(
  expected: ResolutionSnapshot,
  actual: ResolutionSnapshot,
): ResolutionDifference[] {
  const differences: ResolutionDifference[] = [];

  if (expected.agentyxVersion !== actual.agentyxVersion) {
    differences.push({ kind: "agentyx-version", change: "changed" });
  }

  if (expected.configHash !== actual.configHash) {
    differences.push({ kind: "config", change: "changed" });
  }

  compareNames(expected.targets, actual.targets, "targets", differences);
  compareCapabilities(expected.skills, actual.skills, "skill", differences);
  compareCapabilities(expected.mcpServers, actual.mcpServers, "mcp", differences);
  compareCapabilities(expected.tools, actual.tools, "tool", differences);
  compareCapabilities(expected.hooks, actual.hooks, "hook", differences);
  compareCapabilities(expected.agents, actual.agents, "agent", differences);

  return differences;
}

function canonicalConfig(config: AgentyxConfig): unknown {
  const { $schema: _schema, ...desired } = config;

  return {
    ...desired,
    targets: sortedUnique(config.targets),
    enable: sortedUnique(config.enable),
    ...(config.exclude === undefined
      ? {}
      : {
          exclude: {
            skills: sortedUnique(config.exclude.skills),
            mcpServers: sortedUnique(config.exclude.mcpServers),
            tools: sortedUnique(config.exclude.tools),
            hooks: sortedUnique(config.exclude.hooks),
            agents: sortedUnique(config.exclude.agents),
          },
        }),
  };
}

function capabilityOrigins(
  resolved: ResolvedAgentyxConfig,
  packRegistry: PackRegistry,
): ReadonlyMap<string, readonly ResolutionOrigin[]> {
  const byKey = new Map<string, readonly ResolutionOrigin[]>();
  const provenance = new Map(
    deriveCapabilityProvenance(resolved.resolvedPacks, packRegistry).map((entry) => [
      `${entry.kind}:${entry.name}`,
      entry.packs.map((name) => ({ kind: "pack" as const, name })),
    ]),
  );

  const add = (kind: string, name: string): void => {
    const key = `${kind}:${name}`;
    const origins = provenance.get(key);

    if (origins !== undefined) {
      byKey.set(key, origins);
    } else if (kind === "skill" && name === "agentyx-project-context") {
      byKey.set(key, [{ kind: "project-context" }]);
    }
  };

  for (const name of resolved.skills) add("skill", name);
  for (const name of resolved.mcpServers) add("mcp", name);
  for (const name of resolved.tools) add("tool", name);
  for (const name of resolved.hooks) add("hook", name);
  for (const name of resolved.agents) add("agent", name);

  return byKey;
}

function snapshotCapability(
  kind: CapabilityKind,
  name: string,
  origins: ReadonlyMap<string, readonly ResolutionOrigin[]>,
  hash: () => string,
): ResolutionCapability {
  return {
    name,
    hash: hash(),
    origins: [...(origins.get(`${kind}:${name}`) ?? [])],
  };
}

function hashSkill(skillRegistry: SkillRegistry, name: string): string {
  return hashContent(formatSkillMarkdown(skillRegistry.get(name)));
}

function hashDefinition(definition: unknown): string {
  return hashContent(canonicalJson(definition));
}

function compareNames(
  expected: readonly string[],
  actual: readonly string[],
  kind: "targets",
  differences: ResolutionDifference[],
): void {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  for (const name of sortedUnique([...expectedSet, ...actualSet])) {
    if (!expectedSet.has(name)) differences.push({ kind, name, change: "added" });
    else if (!actualSet.has(name)) differences.push({ kind, name, change: "removed" });
  }
}

function compareCapabilities(
  expected: readonly ResolutionCapability[],
  actual: readonly ResolutionCapability[],
  kind: "skill" | "mcp" | "tool" | "hook" | "agent",
  differences: ResolutionDifference[],
): void {
  const expectedByName = new Map(expected.map((entry) => [entry.name, entry]));
  const actualByName = new Map(actual.map((entry) => [entry.name, entry]));

  for (const name of sortedUnique([...expectedByName.keys(), ...actualByName.keys()])) {
    const expectedEntry = expectedByName.get(name);
    const actualEntry = actualByName.get(name);

    if (expectedEntry === undefined) differences.push({ kind, name, change: "added" });
    else if (actualEntry === undefined) differences.push({ kind, name, change: "removed" });
    else if (canonicalJson(expectedEntry) !== canonicalJson(actualEntry))
      differences.push({ kind, name, change: "changed" });
  }
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
