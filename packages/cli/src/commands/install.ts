import {
  applyInstallPlans,
  collectInstallConflicts,
  detectConfiguredTargets,
  InstallConflictError,
  type InstallPlan,
  type InstallPlanSummary,
  planInstall,
  summarizeInstallPlans,
} from "@agentyx/adapters";
import {
  AgentyxError,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  loadAgentyxProject,
  loadInstallManifest,
  resolveAgentyxConfig,
  type SkillRegistry,
} from "@agentyx/core";
import { autocompleteMultiselect, isCancel, multiselect } from "@clack/prompts";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";
import {
  mcpOptions,
  packOptions,
  skillNamesForPacks,
  skillOptions,
  targetOptions,
} from "../prompts.js";

export interface InstallCommandInput {
  /**
   * Packs passed on the command line. As with `resolve`, they replace the
   * packs from `.agentyx.json` and the project configuration is not read at all
   * — which also means the targets must then be explicit.
   */
  readonly packs: readonly string[];
  readonly enable?: readonly string[];
  /** `--target`, repeatable. Overrides the targets in `.agentyx.json` for this run only. */
  readonly targets: readonly string[];
  readonly skills: readonly string[];
  readonly mcpServers: readonly string[];
  readonly select: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly skillsOnly?: boolean;
  readonly mcpOnly?: boolean;
  /** Remove managed files and MCP entries the current selection no longer resolves. */
  readonly prune?: boolean;
  /** Overwrite files Agentyx does not manage instead of refusing to touch them. */
  readonly force?: boolean;
  readonly cwd: string;
}

export class InstallCommandError extends AgentyxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "InstallCommandError";
  }
}

/**
 * Produces the exact text `agentyx install` writes to stdout, and, unless this is
 * a dry run, performs the installation.
 *
 * The skills are loaded once and handed to every target, so the providers
 * cannot receive different instructions; the plans differ only in where the
 * files go. `.agentyx.json` is never modified.
 *
 * `.agentyx.lock.json` decides what Agentyx is allowed to touch. A destination it
 * has no record of writing is reported as a conflict and the run stops without
 * writing anything, so an installation can never quietly replace a hand-written
 * skill that happens to share a name.
 *
 * @throws {AgentyxConfigNotFoundError} when no packs were named and the project has no configuration.
 * @throws {MissingInstallTargetsError} when neither the configuration nor `--target` names a target.
 * @throws {UnknownAdapterError} when a target has no adapter.
 * @throws {InstallConflictError} when a destination is not Agentyx's to write, and `--force` was not given.
 */
export async function runInstallCommand(input: InstallCommandInput): Promise<string> {
  const outcome = await executeInstall(input);

  return input.json ? toJson(outcome.report) : outcome.text;
}

/** Both renderings of one installation, so a caller can compose either. */
export interface InstallOutcome {
  readonly text: string;
  readonly report: InstallReport;
  readonly summary: InstallPlanSummary;
}

/**
 * Performs the installation and renders it, without deciding which rendering
 * the caller wants.
 *
 * `init` uses this to finish the job it started rather than telling the user to
 * run a second command, and gets the same plan, the same conflict rules and the
 * same output as `agentyx install` because it is the same code path.
 */
export async function executeInstall(input: InstallCommandInput): Promise<InstallOutcome> {
  if (input.skillsOnly === true && input.mcpOnly === true) {
    throw new InstallCommandError(
      "install_scope_conflict",
      "--skills-only and --mcp-only cannot be used together.",
    );
  }

  const environment = await resolveEnvironment(input);
  const skills = input.mcpOnly
    ? []
    : environment.skills.map((name) => environment.skillRegistry.get(name));
  const mcpServers = input.skillsOnly
    ? []
    : environment.mcpServers.map((name) => builtInMcpServerRegistry.get(name));
  const manifest = await loadInstallManifest(input.cwd);
  const plans = await planInstall({
    targets: environment.targets,
    projectDir: input.cwd,
    skills,
    mcpServers,
    manifest,
    prune: input.prune === true,
    force: input.force === true,
  });
  const conflicts = collectInstallConflicts(plans);

  if (conflicts.length > 0 && !input.dryRun) {
    throw new InstallConflictError(conflicts);
  }

  if (!input.dryRun) {
    await applyInstallPlans(plans, { manifest });
  }

  return {
    text: renderText(input, plans, conflicts),
    report: buildInstallReport(input, environment, plans, conflicts),
    summary: summarizeInstallPlans(plans),
  };
}

interface ResolvedEnvironment {
  readonly packs: readonly string[];
  readonly skills: readonly string[];
  readonly declaredMcpServers: readonly { readonly name: string; readonly activation: string }[];
  readonly mcpServers: readonly string[];
  readonly declaredTools: readonly { readonly name: string; readonly activation: string }[];
  readonly tools: readonly string[];
  readonly enabled: readonly string[];
  readonly targets: readonly string[];
  readonly skillRegistry: SkillRegistry;
}

async function resolveEnvironment(input: InstallCommandInput): Promise<ResolvedEnvironment> {
  const selected = input.select ? await promptManualSelection(input) : input;
  const manual = selected.skills.length > 0 || selected.mcpServers.length > 0;

  if (manual) {
    if (selected.packs.length > 0) {
      throw new InstallCommandError(
        "manual_install_with_packs",
        "Manual --skill/--mcp selection cannot be combined with pack arguments.",
      );
    }

    for (const name of selected.skills) {
      builtInSkillRegistry.get(name);
    }

    for (const name of selected.mcpServers) {
      builtInMcpServerRegistry.get(name);
    }

    return {
      packs: [],
      skills: unique(selected.skills),
      declaredMcpServers: unique(selected.mcpServers).map((name) => ({
        name,
        activation: "default",
      })),
      mcpServers: unique(selected.mcpServers),
      declaredTools: [],
      tools: [],
      enabled: [],
      targets: selected.targets,
      skillRegistry: builtInSkillRegistry,
    };
  }

  if (input.packs.length > 0) {
    const resolved = resolveAgentyxConfig({
      packs: [...input.packs],
      enable: [...(input.enable ?? [])],
      targets: [],
    });

    return {
      packs: resolved.resolvedPacks,
      skills: resolved.skills,
      declaredMcpServers: resolved.declaredMcpServers,
      mcpServers: resolved.mcpServers,
      declaredTools: resolved.declaredTools,
      tools: resolved.tools,
      enabled: resolved.enabled,
      targets: input.targets,
      skillRegistry: builtInSkillRegistry,
    };
  }

  const project = await loadAgentyxProject(input.cwd);
  const config = project.config;
  const resolved = resolveAgentyxConfig(
    {
      ...config,
      enable: [...unique([...config.enable, ...(input.enable ?? [])])],
    },
    project.packRegistry,
    project.skillRegistry,
  );

  return {
    packs: resolved.resolvedPacks,
    skills: resolved.skills,
    declaredMcpServers: resolved.declaredMcpServers,
    mcpServers: resolved.mcpServers,
    declaredTools: resolved.declaredTools,
    tools: resolved.tools,
    enabled: resolved.enabled,
    targets: input.targets.length > 0 ? input.targets : resolved.targets,
    skillRegistry: project.skillRegistry,
  };
}

/**
 * Walks the user through a manual selection.
 *
 * Agentyx ships far more skills than fit on a screen, so the skill step is a
 * searchable list rather than a scrollable one, and an optional pack filter
 * runs first to shorten it. The filter only decides what is *shown*: skipping
 * it offers every skill, and the packs chosen here are never written to
 * `.agentyx.json` — a manual selection stays a list of skills.
 *
 * Anything already passed on the command line skips its step.
 */
async function promptManualSelection(input: InstallCommandInput): Promise<InstallCommandInput> {
  const configured = await detectConfiguredTargets(input.cwd);
  const targets =
    input.targets.length > 0
      ? input.targets
      : await promptValue(
          multiselect({
            message: "Targets",
            initialValues: [...configured],
            required: true,
            options: [...targetOptions(configured)],
          }),
        );
  const browsePacks =
    input.skills.length > 0
      ? []
      : await promptValue(
          autocompleteMultiselect({
            message: "Narrow the skill list by pack (optional — leave empty for all)",
            required: false,
            maxItems: 10,
            placeholder: "Type to search packs...",
            options: [...packOptions()],
          }),
        );
  const browsable = skillNamesForPacks(browsePacks);
  const skills =
    input.skills.length > 0
      ? input.skills
      : await promptValue(
          autocompleteMultiselect({
            message:
              browsePacks.length === 0
                ? "Skills"
                : `Skills from ${browsePacks.join(", ")} (${browsable.length})`,
            required: false,
            maxItems: 10,
            placeholder: "Type to search skills...",
            options: [...skillOptions(browsable)],
          }),
        );
  const mcpServers =
    input.mcpServers.length > 0
      ? input.mcpServers
      : await promptValue(
          autocompleteMultiselect({
            message: "MCP servers",
            required: false,
            maxItems: 10,
            placeholder: "Type to search MCP servers...",
            options: [...mcpOptions()],
          }),
        );

  if (skills.length === 0 && mcpServers.length === 0) {
    throw new InstallCommandError(
      "manual_install_empty",
      "Select at least one skill or MCP server to install.",
    );
  }

  return { ...input, targets, skills, mcpServers };
}

async function promptValue<T>(value: Promise<T | symbol>): Promise<T> {
  const resolved = await value;

  if (isCancel(resolved)) {
    throw new InstallCommandError(
      "install_cancelled",
      "Agentyx install cancelled. No files were written.",
    );
  }

  return resolved;
}

/** Plans are reported per target, then summarised. Paths stay project-relative. */
function renderText(
  input: InstallCommandInput,
  plans: readonly InstallPlan[],
  conflicts: readonly string[],
): string {
  const summary = summarizeInstallPlans(plans);
  const blocks = plans.map((plan) =>
    [
      `${plan.target} -> ${plan.relativeSkillsPath}`,
      section(
        "Skills",
        plan.operations
          .filter((operation) => operation.usedBy[0] === plan.target)
          .map((operation) =>
            renderOperationLine(operation.status, operation.relativePath, operation.usedBy),
          ),
      ),
      section("MCP", [
        ...plan.mcpOperations
          .filter((operation) => operation.usedBy[0] === plan.target)
          .map((operation) =>
            renderOperationLine(
              operation.status,
              `${operation.relativePath} (${operation.servers.join(", ")})`,
              operation.usedBy,
            ),
          ),
        ...plan.unsupportedMcp.map((name) => `unsupported project scope ${name}`),
      ]),
      ...(plan.deletions.length > 0
        ? [
            section(
              "Removed",
              plan.deletions
                .filter((operation) => operation.usedBy[0] === plan.target)
                .map((operation) =>
                  renderOperationLine(operation.status, operation.relativePath, operation.usedBy),
                ),
            ),
          ]
        : []),
    ].join("\n"),
  );
  const conflictBlock =
    conflicts.length > 0
      ? [
          section("Conflicts", conflicts),
          "These files are not Agentyx's to replace. Move or delete them, or re-run with --force.",
        ]
      : [];
  const footer = input.dryRun
    ? `Dry run: ${summary.create} to create, ${summary.update} to update, ${summary.delete} to remove, ${summary.unchanged} unchanged, ${summary.conflict} blocked. Nothing was written.`
    : `Installed: ${summary.create + summary.update} written, ${summary.delete} removed, ${summary.unchanged} unchanged.`;

  return [
    input.dryRun ? "Agentyx install (dry run)" : "Agentyx install",
    ...blocks,
    ...conflictBlock,
    footer,
  ].join("\n\n");
}

function renderOperationLine(status: string, detail: string, usedBy: readonly string[]): string {
  const suffix = usedBy.length > 1 ? ` (used by: ${usedBy.join(", ")})` : "";

  return `${status.padEnd(9)} ${detail}${suffix}`;
}

/**
 * The machine-readable plan. Skill bodies are left out for the same reason
 * `resolve` prints identifiers only: the output stays cheap to pipe, and the
 * instructions have exactly one home.
 */
function buildInstallReport(
  input: InstallCommandInput,
  environment: ResolvedEnvironment,
  plans: readonly InstallPlan[],
  conflicts: readonly string[],
) {
  return {
    dryRun: input.dryRun,
    conflicts,
    packs: environment.packs,
    skills: environment.skills,
    declaredMcpServers: environment.declaredMcpServers,
    mcpServers: environment.mcpServers,
    declaredTools: environment.declaredTools,
    tools: environment.tools,
    enabled: environment.enabled,
    targets: plans.map((plan) => plan.target),
    plans: plans.map((plan) => ({
      target: plan.target,
      name: plan.name,
      skillsPath: plan.relativeSkillsPath,
      operations: plan.operations.map((operation) => ({
        type: operation.type,
        status: operation.status,
        skill: operation.skill,
        path: operation.relativePath,
        usedBy: operation.usedBy,
      })),
      mcpOperations: plan.mcpOperations.map((operation) => ({
        type: operation.type,
        status: operation.status,
        servers: operation.servers,
        path: operation.relativePath,
        usedBy: operation.usedBy,
      })),
      deletions: plan.deletions.map((operation) => ({
        type: operation.type,
        status: operation.status,
        kind: operation.kind,
        skill: operation.skill,
        path: operation.relativePath,
        usedBy: operation.usedBy,
      })),
      unsupportedMcp: plan.unsupportedMcp,
    })),
    summary: summarizeInstallPlans(plans),
  };
}

/**
 * The machine-readable install report, derived from the builder rather than
 * declared twice — the JSON output has exactly one definition.
 */
export type InstallReport = ReturnType<typeof buildInstallReport>;

function collectTarget(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectName(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function createInstallCommand(): Command {
  return new Command("install")
    .description("Install the resolved skills into each target agent.")
    .argument("[packs...]", "install these packs instead of the ones in .agentyx.json")
    .option(
      "--enable <id>",
      "enable an optional capability for this run; repeatable",
      collectName,
      [],
    )
    .option(
      "--target <id>",
      "install into this target instead of the configured ones; repeatable",
      collectTarget,
      [],
    )
    .option("--skill <id>", "install one built-in skill directly; repeatable", collectName, [])
    .option("--mcp <id>", "install one built-in MCP server directly; repeatable", collectName, [])
    .option("--select", "choose targets, skills and MCP servers interactively", false)
    .option("--dry-run", "report the planned changes without writing anything", false)
    .option("--json", "print machine-readable JSON only", false)
    .option("--skills-only", "install skills without MCP configuration", false)
    .option("--mcp-only", "install MCP configuration without skills", false)
    .option("--prune", "remove managed files the current selection no longer resolves", false)
    .option("--force", "overwrite files Agentyx does not manage", false)
    .action(
      async (
        packs: string[],
        options: {
          target: string[];
          skill: string[];
          mcp: string[];
          enable: string[];
          select: boolean;
          dryRun: boolean;
          json: boolean;
          skillsOnly: boolean;
          mcpOnly: boolean;
          prune: boolean;
          force: boolean;
        },
      ) => {
        await emit(() =>
          runInstallCommand({
            packs,
            enable: options.enable,
            targets: options.target,
            skills: options.skill,
            mcpServers: options.mcp,
            select: options.select,
            dryRun: options.dryRun,
            json: options.json,
            skillsOnly: options.skillsOnly,
            mcpOnly: options.mcpOnly,
            prune: options.prune,
            force: options.force,
            cwd: process.cwd(),
          }),
        );
      },
    );
}
