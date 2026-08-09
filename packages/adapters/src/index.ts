import { agentyxCoreName } from "@agentyx/core";

export type {
  AdapterCapabilities,
  AdapterContext,
  AdapterDetection,
  AgentAdapter,
  PlannedFile,
  PlannedMcpConfig,
} from "./adapter.js";
export {
  builtInAdapterDefinitions,
  builtInAdapterRegistry,
  builtInAdapters,
} from "./built-in.js";
export {
  DuplicateAdapterError,
  InstallPathError,
  MissingInstallTargetsError,
  ProviderConfigParseError,
  SharedInstallConflictError,
  UnknownAdapterError,
} from "./errors.js";
export type { InstallResult } from "./executor.js";
export { applyInstallPlan, applyInstallPlans } from "./executor.js";
export type {
  InstallOperation,
  InstallOperationStatus,
  InstallPlan,
  InstallPlanSummary,
  McpInstallOperation,
} from "./plan.js";
export { summarizeInstallPlans } from "./plan.js";
export type { PlanInstallInput, PlanTargetInstallInput } from "./planner.js";
export { planInstall, planTargetInstall } from "./planner.js";
export type { AdapterRegistry } from "./registry.js";
export { createAdapterRegistry } from "./registry.js";
export type { SkillDirectoryAdapterDefinition } from "./skill-directory.js";
export { createSkillDirectoryAdapter, SKILL_FILENAME } from "./skill-directory.js";

export const agentyxAdaptersName = "agentyx-adapters";

export function getAdaptersStatus(): string {
  return `${agentyxAdaptersName}:${agentyxCoreName}`;
}
