import {
  applyInstallPlans,
  builtInAdapterRegistry,
  type InstallPlan,
  planInstall,
  summarizeInstallPlans,
} from "@agentyx/adapters";
import {
  AgentyxError,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  loadAgentyxConfig,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { isCancel, multiselect } from "@clack/prompts";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

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
 * @throws {AgentyxConfigNotFoundError} when no packs were named and the project has no configuration.
 * @throws {MissingInstallTargetsError} when neither the configuration nor `--target` names a target.
 * @throws {UnknownAdapterError} when a target has no adapter.
 */
export async function runInstallCommand(input: InstallCommandInput): Promise<string> {
  const environment = await resolveEnvironment(input);
  const skills = input.mcpOnly
    ? []
    : environment.skills.map((name) => builtInSkillRegistry.get(name));
  const mcpServers = input.skillsOnly
    ? []
    : environment.mcpServers.map((name) => builtInMcpServerRegistry.get(name));
  const plans = await planInstall({
    targets: environment.targets,
    projectDir: input.cwd,
    skills,
    mcpServers,
  });

  if (!input.dryRun) {
    await applyInstallPlans(plans);
  }

  return input.json ? renderJson(input, environment, plans) : renderText(input, plans);
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
    };
  }

  const config = await loadAgentyxConfig(input.cwd);
  const resolved = resolveAgentyxConfig({
    ...config,
    enable: [...unique([...config.enable, ...(input.enable ?? [])])],
  });

  return {
    packs: resolved.resolvedPacks,
    skills: resolved.skills,
    declaredMcpServers: resolved.declaredMcpServers,
    mcpServers: resolved.mcpServers,
    declaredTools: resolved.declaredTools,
    tools: resolved.tools,
    enabled: resolved.enabled,
    targets: input.targets.length > 0 ? input.targets : resolved.targets,
  };
}

async function promptManualSelection(input: InstallCommandInput): Promise<InstallCommandInput> {
  const targets =
    input.targets.length > 0
      ? input.targets
      : await promptValue(
          multiselect({
            message: "Targets",
            initialValues: ["codex"],
            required: true,
            options: builtInAdapterRegistry.list().map((adapter) => ({
              value: adapter.id,
              label: adapter.name,
            })),
          }),
        );
  const skills =
    input.skills.length > 0
      ? input.skills
      : await promptValue(
          multiselect({
            message: "Skills",
            initialValues: ["planning", "verification"],
            options: builtInSkillRegistry.names.map((name) => ({ value: name, label: name })),
          }),
        );
  const mcpServers =
    input.mcpServers.length > 0
      ? input.mcpServers
      : await promptValue(
          multiselect({
            message: "MCP servers",
            options: builtInMcpServerRegistry.listMetadata().map((server) => ({
              value: server.name,
              label: server.name,
              hint: `${server.transport}, ${server.contextCost ?? "unknown"} context`,
            })),
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
function renderText(input: InstallCommandInput, plans: readonly InstallPlan[]): string {
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
    ].join("\n"),
  );
  const footer = input.dryRun
    ? `Dry run: ${summary.create} to create, ${summary.update} to update, ${summary.unchanged} unchanged. Nothing was written.`
    : `Installed: ${summary.create + summary.update} written, ${summary.unchanged} unchanged.`;

  return [input.dryRun ? "Agentyx install (dry run)" : "Agentyx install", ...blocks, footer].join(
    "\n\n",
  );
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
function renderJson(
  input: InstallCommandInput,
  environment: ResolvedEnvironment,
  plans: readonly InstallPlan[],
): string {
  return toJson({
    dryRun: input.dryRun,
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
      unsupportedMcp: plan.unsupportedMcp,
    })),
    summary: summarizeInstallPlans(plans),
  });
}

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
            cwd: process.cwd(),
          }),
        );
      },
    );
}
