import { relative, sep } from "node:path";
import { builtInAdapterRegistry } from "@agentyx/adapters";
import { Command } from "commander";
import { emit, toJson } from "../output.js";

/** The installable target ids, one per line. */
export function runTargetListCommand(): string {
  return builtInAdapterRegistry.ids.join("\n");
}

export interface TargetShowCommandInput {
  readonly target: string;
  readonly json: boolean;
  readonly cwd: string;
}

/**
 * Renders one target: its id, its provider name, and where it installs skills
 * in this project — nothing about how the adapter works.
 *
 * @throws {UnknownAdapterError} when the target has no adapter.
 */
export async function runTargetShowCommand(input: TargetShowCommandInput): Promise<string> {
  const adapter = builtInAdapterRegistry.get(input.target);
  const detection = await adapter.detect(input.cwd);
  const skillsPath = relative(input.cwd, detection.skillsPath).split(sep).join("/");
  const mcpPath =
    adapter.mcpConfigPath === undefined
      ? undefined
      : relative(input.cwd, adapter.mcpConfigPath(input.cwd)).split(sep).join("/");

  if (input.json) {
    return toJson({
      id: adapter.id,
      name: adapter.name,
      skillsPath,
      present: detection.present,
      mcp: {
        project: adapter.capabilities.mcp.project,
        path: mcpPath,
        transports: adapter.capabilities.mcp.transports ?? [],
      },
      references: adapter.references ?? [],
    });
  }

  return [
    adapter.id,
    adapter.name,
    `Skills: ${skillsPath}${detection.present ? "" : " (not present)"}`,
    `MCP: ${mcpPath ?? "not supported"}${adapter.capabilities.mcp.project ? "" : " (not supported)"}`,
    `MCP transports: ${(adapter.capabilities.mcp.transports ?? []).join(", ") || "none"}`,
    ...(adapter.references ?? []).map((reference) => `Reference: ${reference}`),
  ].join("\n");
}

export function createTargetCommand(): Command {
  const target = new Command("target").description("Inspect the agents Agentyx can install into.");

  target
    .command("list")
    .description("List the installable target ids.")
    .action(async () => {
      await emit(() => runTargetListCommand());
    });

  target
    .command("show")
    .description("Print one target and where it installs skills.")
    .argument("<target>", "target id, for example codex")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (id: string, options: { json: boolean }) => {
      await emit(() =>
        runTargetShowCommand({ target: id, json: options.json, cwd: process.cwd() }),
      );
    });

  return target;
}
