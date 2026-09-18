import {
  AgentyxConfigNotFoundError,
  AgentyxConfigParseError,
  AgentyxConfigValidationError,
  detectProject,
  loadAgentyxProject,
  type ProjectSignals,
  type Recommendation,
  recommendCapabilities,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface RecommendCommandInput {
  readonly json: boolean;
  readonly cwd: string;
}

/**
 * Reads project metadata and a small, known set of repository files, then recommends packs and
 * optional capabilities with a reason for each. Deterministic and read-only: no network, no
 * telemetry, no LLM, and never a write — enabling anything remains a separate, explicit step.
 */
export async function runRecommendCommand(input: RecommendCommandInput): Promise<string> {
  const detection = await detectProject(input.cwd);
  const configuredPacks = await readConfiguredPacks(input.cwd);
  const result = recommendCapabilities(detection.signals, { configuredPacks });

  if (input.json) {
    return toJson({
      signals: detection.signals,
      packs: result.packs,
      capabilities: result.capabilities,
    });
  }

  return [
    "Agentyx recommendations",
    "",
    section("Detected", detectedLabels(detection.signals)),
    "",
    renderRecommendationBlock("Packs", result.packs, true),
    "",
    renderRecommendationBlock("Optional capabilities", result.capabilities, false),
  ].join("\n");
}

/**
 * The project's own configured packs, when `.agentyx.json` exists and is valid — used only to
 * decide capability recommendations that depend on an already-selected pack (`rtk`, `playwright`).
 * A missing or broken config does not stop `recommend`: it just means those checks see no pack
 * selected, exactly like a project that has not run `init` yet.
 */
async function readConfiguredPacks(cwd: string): Promise<readonly string[] | undefined> {
  try {
    const project = await loadAgentyxProject(cwd);
    return project.config.packs;
  } catch (cause) {
    if (
      cause instanceof AgentyxConfigNotFoundError ||
      cause instanceof AgentyxConfigParseError ||
      cause instanceof AgentyxConfigValidationError
    ) {
      return undefined;
    }

    throw cause;
  }
}

function renderRecommendationBlock(
  title: string,
  recommendations: readonly Recommendation[],
  showConfidence: boolean,
): string {
  if (recommendations.length === 0) {
    return [title, "  (none)"].join("\n");
  }

  const blocks = recommendations.map((recommendation) =>
    [
      showConfidence
        ? `  ${recommendation.name.padEnd(14)} ${recommendation.confidence}`
        : `  ${recommendation.name}`,
      ...recommendation.reasons.map((reason) => `    ${reason}`),
    ].join("\n"),
  );

  return [title, "", blocks.join("\n\n")].join("\n");
}

const TECHNOLOGY_LABELS: Readonly<Record<string, string>> = {
  vitest: "Vitest",
  jest: "Jest",
  "@playwright/test": "Playwright",
  cypress: "Cypress",
  karma: "Karma",
  "drizzle-orm": "Drizzle",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  "axe-core": "axe-core",
  pa11y: "pa11y",
};

function labelFor(dependency: string): string {
  const known = TECHNOLOGY_LABELS[dependency];

  if (known !== undefined) {
    return known;
  }

  const scopedPrefixes: ReadonlyMap<string, string> = new Map([
    ["@sentry/", "Sentry"],
    ["@opentelemetry/", "OpenTelemetry"],
    ["@supabase/", "Supabase"],
    ["@axe-core/", "axe-core"],
    ["@jest/", "Jest"],
  ]);

  for (const [prefix, label] of scopedPrefixes) {
    if (dependency.startsWith(prefix)) {
      return label;
    }
  }

  return dependency;
}

/**
 * A short, deduplicated list of the technologies `ProjectSignals` actually observed. Shared with
 * `init`'s "Detected" line so both commands describe a project the same way.
 */
export function detectedLabels(signals: ProjectSignals): readonly string[] {
  const labels: string[] = [];
  const add = (label: string): void => {
    if (!labels.includes(label)) {
      labels.push(label);
    }
  };

  if (signals.angular !== undefined) {
    add("Angular");
  }

  if (signals.typescript.dependency !== undefined || signals.typescript.tsconfig) {
    add("TypeScript");
  }

  for (const match of [
    ...signals.testFrameworks,
    ...signals.browserTesting,
    ...signals.observability,
    ...signals.dataTooling,
    ...signals.accessibilityTooling,
  ]) {
    add(labelFor(match.dependency));
  }

  if (signals.containers.dockerfile || signals.containers.compose) {
    add("Docker");
  }

  if (signals.ci.githubActions) {
    add("GitHub Actions");
  }

  if (signals.monorepo.detected) {
    add("Monorepo");
  }

  return labels;
}

export function createRecommendCommand(): Command {
  return new Command("recommend")
    .description(
      "Suggest packs and optional capabilities from this project's own files. Read-only.",
    )
    .option("--json", "print machine-readable JSON only", false)
    .action(async (options: { json: boolean }) => {
      await emit(() => runRecommendCommand({ json: options.json, cwd: process.cwd() }));
    });
}
