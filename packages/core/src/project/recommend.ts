import { builtInPackRegistry } from "../pack/registry.js";
import type { ProjectSignals, TechnologyMatch } from "./signals.js";

export const RECOMMENDATION_CONFIDENCES = ["high", "medium"] as const;
export type RecommendationConfidence = (typeof RECOMMENDATION_CONFIDENCES)[number];

export type RecommendationKind = "pack" | "capability";

/**
 * A deterministic suggestion, always with a human-readable reason. `high` means a direct, strong
 * signal (an exact dependency or file match); `medium` means useful but less certain, such as a
 * size heuristic. There is no `low` tier in v1 — a signal too weak for `medium` is not surfaced.
 */
export interface Recommendation {
  readonly kind: RecommendationKind;
  readonly name: string;
  readonly confidence: RecommendationConfidence;
  readonly reasons: readonly string[];
  /** Packs that declare this as an optional capability. Present only for `kind: "capability"`. */
  readonly contributedBy?: readonly string[];
}

export interface RecommendationResult {
  readonly packs: readonly Recommendation[];
  readonly capabilities: readonly Recommendation[];
}

export interface RecommendCapabilitiesOptions {
  /** Packs already selected in the project's own `.agentyx.json`, if one exists. */
  readonly configuredPacks?: readonly string[] | undefined;
}

/**
 * Heuristic thresholds for the `codebase-memory` capability suggestion, in scanned source files.
 * These are approximate signals, not exact token accounting, and a monorepo is treated as already
 * complex enough to lower the bar.
 */
export const CODEBASE_MEMORY_FILE_THRESHOLD = 2000;
export const CODEBASE_MEMORY_MONOREPO_FILE_THRESHOLD = 800;

/**
 * Applies conservative, deterministic policy on top of `ProjectSignals`. This is the only place
 * that turns an observed fact into a product suggestion — `ProjectSignals` stays fact-only so it
 * can be tested independently of pack names or capability policy.
 *
 * Never enables anything and never touches the filesystem: the caller decides what, if anything,
 * to do with the result.
 */
export function recommendCapabilities(
  signals: ProjectSignals,
  options: RecommendCapabilitiesOptions = {},
): RecommendationResult {
  const packs = recommendPacks(signals);
  const configuredPacks = options.configuredPacks ?? [];
  const activePacks = new Set([...packs.map((pack) => pack.name), ...configuredPacks]);
  const capabilities = recommendOptionalCapabilities(signals, activePacks, configuredPacks);

  return { packs, capabilities };
}

function recommendPacks(signals: ProjectSignals): readonly Recommendation[] {
  const packs: Recommendation[] = [];

  if (signals.packageJson.present) {
    packs.push(
      packRecommendation("technical", "high", [
        "package.json detected — baseline engineering practices apply to any software project.",
      ]),
    );
  }

  const typescriptReasons = [
    ...(signals.typescript.dependency !== undefined
      ? [dependencyReason("TypeScript", signals.typescript.dependency)]
      : []),
    ...(signals.typescript.tsconfig ? ["tsconfig.json detected."] : []),
  ];

  if (typescriptReasons.length > 0) {
    packs.push(packRecommendation("typescript", "high", typescriptReasons));
  }

  if (signals.angular !== undefined) {
    packs.push(
      packRecommendation("angular", "high", [dependencyReason("@angular/core", signals.angular)]),
    );
  }

  const testingMatches = dedupeMatches([...signals.testFrameworks, ...signals.browserTesting]);

  if (testingMatches.length > 0) {
    packs.push(
      packRecommendation(
        "testing",
        "high",
        testingMatches.map((match) => dependencyReason(match.dependency, match)),
      ),
    );
  }

  const devopsReasons = [
    ...(signals.containers.dockerfile ? ["Dockerfile detected."] : []),
    ...(signals.containers.compose ? ["Container compose file detected."] : []),
    ...(signals.ci.githubActions ? ["GitHub Actions workflow detected (.github/workflows)."] : []),
  ];

  if (devopsReasons.length > 0) {
    packs.push(packRecommendation("devops", "high", devopsReasons));
  }

  if (signals.observability.length > 0) {
    packs.push(
      packRecommendation(
        "observability",
        "high",
        signals.observability.map((match) => dependencyReason(match.dependency, match)),
      ),
    );
  }

  if (signals.dataTooling.length > 0) {
    packs.push(
      packRecommendation(
        "data",
        "high",
        signals.dataTooling.map((match) => dependencyReason(match.dependency, match)),
      ),
    );
  }

  if (signals.accessibilityTooling.length > 0) {
    packs.push(
      packRecommendation(
        "accessibility",
        "high",
        signals.accessibilityTooling.map((match) => dependencyReason(match.dependency, match)),
      ),
    );
  }

  return packs;
}

function recommendOptionalCapabilities(
  signals: ProjectSignals,
  activePacks: ReadonlySet<string>,
  configuredPacks: readonly string[],
): readonly Recommendation[] {
  const capabilities: Recommendation[] = [];

  const playwrightMatch = signals.browserTesting.find(
    (match) => match.dependency === "@playwright/test",
  );

  if (activePacks.has("testing") && playwrightMatch !== undefined) {
    capabilities.push(
      capabilityRecommendation("playwright", "high", [
        "Playwright is already part of this project; browser MCP may be useful for interactive browser work.",
      ]),
    );
  }

  const sentryMatch = signals.observability.find((match) =>
    match.dependency.startsWith("@sentry/"),
  );

  if (sentryMatch !== undefined) {
    capabilities.push(
      capabilityRecommendation("sentry", "high", ["Sentry is already configured as a dependency."]),
    );
  }

  const supabaseMatch = signals.dataTooling.find((match) =>
    match.dependency.startsWith("@supabase/"),
  );

  if (supabaseMatch !== undefined) {
    capabilities.push(
      capabilityRecommendation("supabase", "high", [
        "Supabase is already configured as a dependency.",
      ]),
    );
  }

  if (configuredPacks.includes("efficiency") && signals.localTools.rtkAvailable) {
    capabilities.push(
      capabilityRecommendation("rtk", "high", ["RTK is already installed locally."]),
    );
  }

  const sizeThreshold = signals.monorepo.detected
    ? CODEBASE_MEMORY_MONOREPO_FILE_THRESHOLD
    : CODEBASE_MEMORY_FILE_THRESHOLD;

  if (signals.repositorySize.filesScanned >= sizeThreshold || signals.repositorySize.capped) {
    capabilities.push(
      capabilityRecommendation("codebase-memory", "medium", [repositorySizeReason(signals)]),
    );
  }

  return capabilities;
}

function repositorySizeReason(signals: ProjectSignals): string {
  const { filesScanned, capped } = signals.repositorySize;
  const scope = signals.monorepo.detected ? " across this monorepo" : "";
  const scanNote = capped
    ? `at least ${filesScanned} source files (the scan was capped before finishing)`
    : `${filesScanned} source files`;

  return (
    `Heuristic: found ${scanNote}${scope}. A persistent codebase-memory MCP may reduce repeated ` +
    "full-tree reads on a repository this size — this is an approximate signal, not an exact token " +
    "measurement."
  );
}

function packRecommendation(
  name: string,
  confidence: RecommendationConfidence,
  reasons: readonly string[],
): Recommendation {
  return { kind: "pack", name, confidence, reasons };
}

/** Provenance comes from the pack registry itself — never a second, hand-maintained capability map. */
function capabilityRecommendation(
  name: string,
  confidence: RecommendationConfidence,
  reasons: readonly string[],
): Recommendation {
  return {
    kind: "capability",
    name,
    confidence,
    reasons,
    contributedBy: packsDeclaringOptionalCapability(name),
  };
}

function packsDeclaringOptionalCapability(name: string): readonly string[] {
  const packs: string[] = [];

  for (const pack of builtInPackRegistry.values()) {
    const declares =
      pack.mcpServers.some((server) => server.name === name && server.activation === "optional") ||
      pack.tools.some((tool) => tool.name === name && tool.activation === "optional") ||
      pack.hooks.some((hook) => hook.name === name && hook.activation === "optional");

    if (declares) {
      packs.push(pack.name);
    }
  }

  return packs;
}

function dependencyReason(label: string, match: TechnologyMatch): string {
  return label === match.dependency
    ? `Detected ${match.dependency} in ${match.field}.`
    : `Detected ${label} (${match.dependency}) in ${match.field}.`;
}

function dedupeMatches(matches: readonly TechnologyMatch[]): readonly TechnologyMatch[] {
  const seen = new Set<string>();
  const result: TechnologyMatch[] = [];

  for (const match of matches) {
    if (!seen.has(match.dependency)) {
      seen.add(match.dependency);
      result.push(match);
    }
  }

  return result;
}
