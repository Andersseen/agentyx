import { Command } from "commander";
import { emit, toJson } from "../output.js";
import { executeInstall, type InstallCommandInput } from "./install.js";

export interface SyncCommandInput {
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly force: boolean;
}

export async function runSyncCommand(input: SyncCommandInput): Promise<string> {
  const install: InstallCommandInput = {
    packs: [],
    targets: [],
    skills: [],
    mcpServers: [],
    select: false,
    dryRun: input.dryRun,
    json: input.json,
    prune: true,
    pruneRemovedTargets: true,
    force: input.force,
    cwd: input.cwd,
  };
  const outcome = await executeInstall(install);
  return input.json
    ? toJson(outcome.report)
    : outcome.text.replaceAll("Agentyx install", "Agentyx sync");
}

export function createSyncCommand(): Command {
  return new Command("sync")
    .description("Make installed provider state match .agentyx.json.")
    .option("--dry-run", "preview convergence without writing", false)
    .option("--json", "print machine-readable JSON only", false)
    .option("--force", "overwrite unmanaged or drifted destinations", false)
    .action(async (options: { dryRun: boolean; json: boolean; force: boolean }) => {
      await emit(() => runSyncCommand({ ...options, cwd: process.cwd() }));
    });
}
