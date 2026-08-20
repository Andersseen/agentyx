import { agentyxCoreName } from "@agentyx/core";

export type {
  AdapterCapabilities,
  AdapterContext,
  AdapterDetection,
  AgentAdapter,
  ExistingMcpConfig,
  PlannedFile,
  PlannedMcpConfig,
} from "./adapter.js";
export {
  builtInAdapterDefinitions,
  builtInAdapterRegistry,
  builtInAdapters,
} from "./built-in.js";
export { detectConfiguredTargets } from "./detect.js";
export {
  DuplicateAdapterError,
  InstallConflictError,
  InstallPathError,
  MissingInstallTargetsError,
  ProviderConfigParseError,
  SharedInstallConflictError,
  UnknownAdapterError,
} from "./errors.js";
export type { ApplyInstallOptions, InstallResult } from "./executor.js";
export { applyInstallPlan, applyInstallPlans } from "./executor.js";
export type {
  DeleteOperation,
  DeleteOperationStatus,
  InstallOperation,
  InstallOperationStatus,
  InstallPlan,
  InstallPlanSummary,
  McpInstallOperation,
} from "./plan.js";
export { collectInstallConflicts, summarizeInstallPlans } from "./plan.js";
export type { PlanInstallInput, PlanTargetInstallInput } from "./planner.js";
export { planInstall, planTargetInstall, planUninstall } from "./planner.js";
export type { AdapterRegistry } from "./registry.js";
export { createAdapterRegistry } from "./registry.js";
export type { SkillDirectoryAdapterDefinition } from "./skill-directory.js";
export { createSkillDirectoryAdapter, SKILL_FILENAME } from "./skill-directory.js";

export const agentyxAdaptersName = "agentyx-adapters";

export function getAdaptersStatus(): string {
  return `${agentyxAdaptersName}:${agentyxCoreName}`;
}
