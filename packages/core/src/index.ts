export type { AgentyxConfigIssue } from "./config/errors.js";
export {
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
  LocalSkillDirectoryError,
  ProjectContextPathError,
  UnknownEnabledCapabilityError,
} from "./config/errors.js";
export { AGENTYX_CONFIG_SCHEMA_ID, buildAgentyxConfigJsonSchema } from "./config/json-schema.js";
export {
  AGENTYX_CONFIG_FILENAME,
  agentyxConfigPath,
  loadAgentyxConfig,
  parseAgentyxConfig,
} from "./config/loader.js";
export {
  type AgentyxConfigMutationChanges,
  AgentyxConfigMutationError,
  type AgentyxConfigMutationResult,
  type AgentyxConfigMutations,
  mutateAgentyxConfig,
} from "./config/mutate.js";
export type { AgentyxProject } from "./config/project.js";
export { loadAgentyxProject } from "./config/project.js";
export type { ResolvedAgentyxConfig } from "./config/resolver.js";
export { resolveAgentyxConfig } from "./config/resolver.js";
export type {
  AgentyxConfig,
  AgentyxConfigInput,
  ProjectContext,
  ProjectMetadata,
  ProjectRelation,
} from "./config/schema.js";
export {
  agentyxConfigSchema,
  agentyxTargetSchema,
  enabledCapabilityNameSchema,
  projectContextSchema,
  projectMetadataSchema,
  projectRelationSchema,
  projectRelationTypeSchema,
  skillDirectorySchema,
} from "./config/schema.js";
export { AgentyxError } from "./errors.js";
export type {
  BaselineCapability,
  BaselineProvider,
  HarnessBaseline,
  HarnessBaselineInput,
} from "./harness/baseline.js";
export {
  computeHarnessObservationBaseline,
  HARNESS_OBSERVATION_CONTRACT_VERSION,
  installedCapabilities,
} from "./harness/baseline.js";
export type { ContextSurfaceEntry, FootprintInput, HarnessFootprint } from "./harness/footprint.js";
export { computeHarnessFootprint } from "./harness/footprint.js";
export type {
  HarnessObservation,
  ObservationCapabilityKind,
  ObservationEvent,
} from "./harness/observation.js";
export {
  harnessObservationSchema,
  hashSessionKey,
  OBSERVATION_CAPABILITY_KINDS,
  OBSERVATION_EVENTS,
  OBSERVATION_VERSION,
  parseObservationLine,
} from "./harness/observation.js";
export type { CapabilityKind, CapabilityProvenance } from "./harness/provenance.js";
export { deriveCapabilityProvenance } from "./harness/provenance.js";
export type { SessionStanding, SessionSummary } from "./harness/sessions.js";
export { summarizeSessions } from "./harness/sessions.js";
export {
  COMPACTION_THRESHOLD_BYTES,
  compactObservations,
  LEGACY_USAGE_FILE_NAMES,
  MAX_RETAINED_SESSIONS,
  MAX_USAGE_FILE_BYTES,
  readObservations,
  recordObservation,
  resolveUsageFile,
  USAGE_FILE_NAME,
} from "./harness/store.js";
export type {
  CapabilityState,
  Evidence,
  ProviderVisibility,
  UtilizationCapability,
  UtilizationInput,
  UtilizationObservationCounts,
  UtilizationPack,
  UtilizationReport,
} from "./harness/utilization.js";
export { computeUtilization, DORMANCY_MIN_SESSIONS } from "./harness/utilization.js";
export { builtInHookNames, builtInHookRegistry } from "./hook/built-in.js";
export {
  DuplicateHookError,
  InvalidHookError,
  UnknownHookError,
} from "./hook/errors.js";
export type { HookMetadata, HookRegistry, HookSource } from "./hook/registry.js";
export { createHookRegistry } from "./hook/registry.js";
export {
  collectPackHookReferences,
  collectPackHooks,
  filterEffectiveHooks,
  resolvePackHookReferences,
  resolvePackHooks,
} from "./hook/resolver.js";
export type {
  HookActivationLevel,
  HookDefinition,
  HookDefinitionInput,
  HookEvent,
  HookReference,
  HookReferenceInput,
} from "./hook/schema.js";
export {
  HOOK_ACTIVATION_LEVELS,
  HOOK_EVENTS,
  hookActivationLevelSchema,
  hookDefinitionSchema,
  hookEventSchema,
  hookNameSchema,
  hookReferenceSchema,
} from "./hook/schema.js";
export type { AgentyxIssue } from "./issues.js";
export { AgentyxManifestParseError, AgentyxManifestValidationError } from "./manifest/errors.js";
export {
  AGENTYX_MANIFEST_FILENAME,
  agentyxManifestPath,
  emptyInstallManifest,
  formatInstallManifest,
  hashContent,
  loadInstallManifest,
  manifestEntriesByPath,
  parseInstallManifest,
} from "./manifest/io.js";
export type {
  HookManifestEntry,
  InstallManifest,
  InstallManifestEntry,
  InstallManifestInput,
  McpManifestEntry,
  SkillManifestEntry,
} from "./manifest/schema.js";
export {
  hookManifestEntrySchema,
  INSTALL_MANIFEST_VERSION,
  installManifestEntrySchema,
  installManifestSchema,
  mcpManifestEntrySchema,
  skillManifestEntrySchema,
} from "./manifest/schema.js";
export { builtInMcpServerNames, builtInMcpServerRegistry } from "./mcp/built-in.js";
export {
  DuplicateMcpServerError,
  InvalidMcpServerError,
  UnknownMcpServerError,
} from "./mcp/errors.js";
export type {
  McpServerMetadata,
  McpServerRegistry,
  McpServerSource,
} from "./mcp/registry.js";
export { createMcpServerRegistry } from "./mcp/registry.js";
export {
  collectPackMcpServerReferences,
  collectPackMcpServers,
  filterEffectiveMcpServers,
  resolvePackMcpServerReferences,
  resolvePackMcpServers,
} from "./mcp/resolver.js";
export type {
  McpCapabilityLevel,
  McpContextCost,
  McpEnvReference,
  McpServerDefinition,
  McpServerDefinitionInput,
  McpServerReference,
  McpServerReferenceInput,
} from "./mcp/schema.js";
export {
  MCP_CAPABILITY_LEVELS,
  MCP_CONTEXT_COSTS,
  mcpCapabilityLevelSchema,
  mcpContextCostSchema,
  mcpEnvReferenceSchema,
  mcpServerDefinitionSchema,
  mcpServerReferenceSchema,
} from "./mcp/schema.js";
export { agentyxCoreName, getCoreStatus } from "./meta.js";
export {
  CircularPackDependencyError,
  DuplicatePackError,
  UnknownPackError,
} from "./pack/errors.js";
export type { PackRegistry } from "./pack/registry.js";
export { builtInPackRegistry, builtInPacks, createPackRegistry } from "./pack/registry.js";
export { resolvePacks } from "./pack/resolver.js";
export type { PackCategory, PackDefinition, PackDefinitionInput } from "./pack/schema.js";
export {
  PACK_CATEGORIES,
  packCategorySchema,
  packDefinitionSchema,
  packNameSchema,
} from "./pack/schema.js";
export type {
  PackageManagerDetection,
  PackageManagerName,
  ProjectDetection,
  ProjectPackageJsonDetection,
} from "./project/detector.js";
export {
  buildAgentyxConfig,
  detectProject,
  formatAgentyxConfig,
  PACKAGE_MANAGERS,
} from "./project/detector.js";
export { isExecutableOnPath } from "./project/executable.js";
export type {
  Recommendation,
  RecommendationConfidence,
  RecommendationKind,
  RecommendationResult,
} from "./project/recommend.js";
export {
  CODEBASE_MEMORY_FILE_THRESHOLD,
  CODEBASE_MEMORY_MONOREPO_FILE_THRESHOLD,
  RECOMMENDATION_CONFIDENCES,
  recommendCapabilities,
} from "./project/recommend.js";
export type {
  CiFileSignals,
  ContainerFileSignals,
  DependencyField,
  MonorepoSignal,
  ProjectSignals,
  RepositorySizeSignal,
  RustSignal,
  TechnologyMatch,
} from "./project/signals.js";
export {
  collectProjectSignals,
  REPOSITORY_SCAN_ENTRY_LIMIT,
  scanRepositorySize,
} from "./project/signals.js";
export type { ProjectGraph } from "./project-graph.js";
export {
  createProjectGraph,
  findProjectCapabilityOwners,
  ProjectGraphNotConfiguredError,
  renderProjectGraphJson,
  renderProjectGraphMermaid,
  renderProjectGraphSvg,
  renderProjectGraphText,
} from "./project-graph.js";
export { builtInSkillNames, builtInSkillRegistry } from "./skill/built-in.js";
export {
  DuplicateSkillError,
  InvalidSkillError,
  UnknownSkillError,
} from "./skill/errors.js";
export { formatSkillMarkdown, parseSkillMarkdown } from "./skill/markdown.js";
export type { SkillRegistry, SkillSource } from "./skill/registry.js";
export { createSkillRegistry } from "./skill/registry.js";
export { resolvePackSkills } from "./skill/resolver.js";
export type { SkillDefinition, SkillDefinitionInput } from "./skill/schema.js";
export { skillDefinitionSchema } from "./skill/schema.js";
export {
  DuplicateTrustedSourceError,
  TrustedSourceLoadError,
  UnknownTrustedSourceError,
} from "./source/errors.js";
export { inspectTrustedSource } from "./source/inspection.js";
export {
  createTrustedSourceRegistry,
  getTrustedSourceDefinition,
  knownTrustedSourceRegistry,
  knownTrustedSources,
} from "./source/registry.js";
export type {
  CodexPluginManifest,
  TrustedSourceDefinition,
  TrustedSourceReference,
  TrustedSourceSkillSummary,
} from "./source/schema.js";
export {
  codexPluginManifestSchema,
  trustedSourceDefinitionSchema,
  trustedSourceNameSchema,
  trustedSourcePathSchema,
  trustedSourceReferenceSchema,
  trustedSourceSkillSummarySchema,
} from "./source/schema.js";
export { builtInToolNames, builtInToolRegistry } from "./tool/built-in.js";
export {
  DuplicateToolError,
  InvalidToolError,
  UnknownToolError,
} from "./tool/errors.js";
export type { ToolMetadata, ToolRegistry, ToolSource } from "./tool/registry.js";
export { createToolRegistry } from "./tool/registry.js";
export {
  collectPackToolReferences,
  filterEffectiveTools,
  resolvePackToolReferences,
  resolvePackTools,
} from "./tool/resolver.js";
export type {
  ToolActivationLevel,
  ToolDefinition,
  ToolDefinitionInput,
  ToolReference,
  ToolReferenceInput,
} from "./tool/schema.js";
export {
  TOOL_ACTIVATION_LEVELS,
  toolActivationLevelSchema,
  toolDefinitionSchema,
  toolNameSchema,
  toolReferenceSchema,
} from "./tool/schema.js";
