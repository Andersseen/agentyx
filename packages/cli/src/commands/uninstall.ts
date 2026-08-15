import {
  applyInstallPlans,
  collectInstallConflicts,
  type InstallPlan,
  planUninstall,
  summarizeInstallPlans,
} from "@agentyx/adapters";
import { AgentyxError, loadInstallManifest } from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface UninstallCommandInput {
  /** `--target`, repeatable. Limits the removal to these targets. */
  readonly targets: readonly string[];
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly cwd: string;
}

export class UninstallCommandError extends AgentyxError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "UninstallCommandError";
  }
}

/**
 * Removes what Agentyx installed, and only what Agentyx installed.
 *
 * The install manifest is the entire input: nothing it does not record is
 * considered, and a recorded file that has been edited since Agentyx wrote it is
 * reported and left in place. `.agentyx.json` is not touched, so the project can
 * be reinstalled afterwards.
 *
 * Provider MCP configuration is shared with the user, so only the server entries
 * Agentyx added are taken back out; the file itself goes only if Agentyx created
 * it and nothing else is left in it.
 *
 * @throws {UninstallCommandError} when the project has nothing recorded to remove.
 * @throws {UnknownAdapterError} when a recorded target has no adapter.
 */
export async function runUninstallCommand(input: UninstallCommandInput): Promise<string> {
  const manifest = await loadInstallManifest(input.cwd);

  if (manifest.entries.length === 0) {
    throw new UninstallCommandError(
      "nothing_installed",
      "Nothing to uninstall: no .agentyx.lock.json records an Agentyx installation in this project.",
    );
  }

  const recorded = [...new Set(manifest.entries.flatMap((entry) => entry.targets))].sort();
  const targets = input.targets.length > 0 ? input.targets : recorded;
  const unknown = input.targets.filter((target) => !recorded.includes(target));

  if (unknown.length > 0) {
    throw new UninstallCommandError(
      "target_not_installed",
      `Nothing is recorded for ${unknown.join(", ")}. Installed targets: ${recorded.join(", ")}.`,
    );
  }

  const plans = await planUninstall({ targets, projectDir: input.cwd, manifest });

  if (!input.dryRun) {
    await applyInstallPlans(plans, { manifest });
  }

  return input.json ? renderJson(input, plans) : renderText(input, plans);
}

function renderText(input: UninstallCommandInput, plans: readonly InstallPlan[]): string {
  const summary = summarizeInstallPlans(plans);
  const conflicts = collectInstallConflicts(plans);
  const blocks = plans.map((plan) =>
    section(
      plan.target,
      plan.deletions
        .filter((operation) => operation.usedBy[0] === plan.target)
        .map((operation) => `${operation.status.padEnd(9)} ${operation.relativePath}`),
    ),
  );
  const conflictBlock =
    conflicts.length > 0
      ? [
          section("Kept", conflicts),
          "These have been edited since Agentyx wrote them, so they were left in place.",
        ]
      : [];
  const footer = input.dryRun
    ? `Dry run: ${summary.delete} to remove, ${summary.conflict} kept. Nothing was removed.`
    : `Uninstalled: ${summary.delete} removed, ${summary.conflict} kept.`;

  return [
    input.dryRun ? "Agentyx uninstall (dry run)" : "Agentyx uninstall",
    ...blocks,
    ...conflictBlock,
    footer,
  ].join("\n\n");
}

function renderJson(input: UninstallCommandInput, plans: readonly InstallPlan[]): string {
  return toJson({
    dryRun: input.dryRun,
    targets: plans.map((plan) => plan.target),
    kept: collectInstallConflicts(plans),
    plans: plans.map((plan) => ({
      target: plan.target,
      name: plan.name,
      deletions: plan.deletions.map((operation) => ({
        status: operation.status,
        kind: operation.kind,
        skill: operation.skill,
        path: operation.relativePath,
        usedBy: operation.usedBy,
      })),
      mcpOperations: plan.mcpOperations.map((operation) => ({
        status: operation.status,
        servers: operation.servers,
        path: operation.relativePath,
      })),
    })),
    summary: summarizeInstallPlans(plans),
  });
}

function collectTarget(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function createUninstallCommand(): Command {
  return new Command("uninstall")
    .description("Remove the skills and MCP entries Agentyx installed into this project.")
    .option(
      "--target <id>",
      "uninstall only this target instead of every recorded one; repeatable",
      collectTarget,
      [],
    )
    .option("--dry-run", "report what would be removed without removing anything", false)
    .option("--json", "print machine-readable JSON only", false)
    .action(async (options: { target: string[]; dryRun: boolean; json: boolean }) => {
      await emit(() =>
        runUninstallCommand({
          targets: options.target,
          dryRun: options.dryRun,
          json: options.json,
          cwd: process.cwd(),
        }),
      );
    });
}
