import type { AgnoxProfile } from "../config/schema.js";
import type { McpCapabilityLevel } from "../mcp/schema.js";

export interface OptimizationProfileDefinition {
  readonly name: AgnoxProfile;
  readonly goal: string;
  readonly mcpLevels: readonly McpCapabilityLevel[];
  readonly notes: readonly string[];
}

export const optimizationProfiles: readonly OptimizationProfileDefinition[] = [
  {
    name: "lean",
    goal: "Minimum context and tool overhead.",
    mcpLevels: ["essential"],
    notes: [
      "Installs all resolved Skills.",
      "Keeps MCP exposure to essential capabilities.",
      "Prefers local CLI or native tools when they cover the same workflow.",
    ],
  },
  {
    name: "balanced",
    goal: "Good default developer experience with conservative autonomy.",
    mcpLevels: ["essential", "recommended"],
    notes: ["Installs all resolved Skills.", "Includes default and recommended MCP capabilities."],
  },
  {
    name: "autonomous",
    goal: "Maximum agent capability from declared stack capabilities.",
    mcpLevels: ["essential", "recommended", "optional"],
    notes: [
      "Installs all resolved Skills.",
      "Includes optional MCP capabilities declared by the selected stacks.",
    ],
  },
];

export const optimizationProfileNames: readonly AgnoxProfile[] = optimizationProfiles.map(
  (profile) => profile.name,
);

export function getOptimizationProfile(name: AgnoxProfile): OptimizationProfileDefinition {
  const profile = optimizationProfiles.find((candidate) => candidate.name === name);

  if (profile === undefined) {
    throw new Error(`Unknown optimization profile: ${name}`);
  }

  return profile;
}

export function isMcpLevelEnabled(profile: AgnoxProfile, level: McpCapabilityLevel): boolean {
  return getOptimizationProfile(profile).mcpLevels.includes(level);
}
