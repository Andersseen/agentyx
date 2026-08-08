import {
  applyInstallPlans,
  type InstallPlan,
  planInstall,
  summarizeInstallPlans,
} from "@agnox/adapters";
import {
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStackMcpServers,
  resolveStackSkills,
  resolveStacks,
} from "@agnox/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface InstallCommandInput {
  /**
   * Stacks passed on the command line. As with `resolve`, they replace the
   * stacks from `.agnox.json` and the project configuration is not read at all
   * — which also means the targets must then be explicit.
   */
  readonly stacks: readonly string[];
  /** `--target`, repeatable. Overrides the targets in `.agnox.json` for this run only. */
  readonly targets: readonly string[];
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly skillsOnly?: boolean;
  readonly mcpOnly?: boolean;
  readonly cwd: string;
}

/**
 * Produces the exact text `agnox install` writes to stdout, and, unless this is
 * a dry run, performs the installation.
 *
 * The skills are loaded once and handed to every target, so the providers
 * cannot receive different instructions; the plans differ only in where the
 * files go. `.agnox.json` is never modified.
 *
 * @throws {AgnoxConfigNotFoundError} when no stacks were named and the project has no configuration.
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
  readonly stacks: readonly string[];
  readonly skills: readonly string[];
  readonly mcpServers: readonly string[];
  readonly targets: readonly string[];
}

async function resolveEnvironment(input: InstallCommandInput): Promise<ResolvedEnvironment> {
  if (input.stacks.length > 0) {
    return {
      stacks: resolveStacks([...input.stacks]),
      skills: resolveStackSkills([...input.stacks]),
      mcpServers: resolveStackMcpServers([...input.stacks]),
      targets: input.targets,
    };
  }

  const resolved = resolveAgnoxConfig(await loadAgnoxConfig(input.cwd));

  return {
    stacks: resolved.resolvedStacks,
    skills: resolved.skills,
    mcpServers: resolved.mcpServers,
    targets: input.targets.length > 0 ? input.targets : resolved.targets,
  };
}

/** Plans are reported per target, then summarised. Paths stay project-relative. */
function renderText(input: InstallCommandInput, plans: readonly InstallPlan[]): string {
  const summary = summarizeInstallPlans(plans);
  const blocks = plans.map((plan) =>
    [
      `${plan.target} -> ${plan.relativeSkillsPath}`,
      section(
        "Skills",
        plan.operations.map(
          (operation) => `${operation.status.padEnd(9)} ${operation.relativePath}`,
        ),
      ),
      section("MCP", [
        ...plan.mcpOperations.map(
          (operation) =>
            `${operation.status.padEnd(9)} ${operation.relativePath} (${operation.servers.join(", ")})`,
        ),
        ...plan.unsupportedMcp.map((name) => `unsupported project scope ${name}`),
      ]),
    ].join("\n"),
  );
  const footer = input.dryRun
    ? `Dry run: ${summary.create} to create, ${summary.update} to update, ${summary.unchanged} unchanged. Nothing was written.`
    : `Installed: ${summary.create + summary.update} written, ${summary.unchanged} unchanged.`;

  return [input.dryRun ? "Agnox install (dry run)" : "Agnox install", ...blocks, footer].join(
    "\n\n",
  );
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
    stacks: environment.stacks,
    skills: environment.skills,
    mcpServers: environment.mcpServers,
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
      })),
      mcpOperations: plan.mcpOperations.map((operation) => ({
        type: operation.type,
        status: operation.status,
        servers: operation.servers,
        path: operation.relativePath,
      })),
      unsupportedMcp: plan.unsupportedMcp,
    })),
    summary: summarizeInstallPlans(plans),
  });
}

function collectTarget(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function createInstallCommand(): Command {
  return new Command("install")
    .description("Install the resolved skills into each target agent.")
    .argument("[stacks...]", "install these stacks instead of the ones in .agnox.json")
    .option(
      "--target <id>",
      "install into this target instead of the configured ones; repeatable",
      collectTarget,
      [],
    )
    .option("--dry-run", "report the planned changes without writing anything", false)
    .option("--json", "print machine-readable JSON only", false)
    .option("--skills-only", "install skills without MCP configuration", false)
    .option("--mcp-only", "install MCP configuration without skills", false)
    .action(
      async (
        stacks: string[],
        options: {
          target: string[];
          dryRun: boolean;
          json: boolean;
          skillsOnly: boolean;
          mcpOnly: boolean;
        },
      ) => {
        await emit(() =>
          runInstallCommand({
            stacks,
            targets: options.target,
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
