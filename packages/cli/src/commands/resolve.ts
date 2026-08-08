import {
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStackMcpServers,
  resolveStackSkills,
  resolveStacks,
} from "@agnox/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface ResolveCommandInput {
  /**
   * Stacks passed on the command line. When present they replace the stacks
   * from `.agnox.json`, and the project configuration is not read at all.
   */
  readonly stacks: readonly string[];
  readonly json: boolean;
  readonly cwd: string;
}

/**
 * Produces the exact text `agnox resolve` writes to stdout. Kept free of
 * terminal side effects so the behaviour can be tested directly.
 *
 * Only skill identifiers are printed — `agnox skill show` is what reads the
 * instructions.
 */
export async function runResolveCommand(input: ResolveCommandInput): Promise<string> {
  if (input.stacks.length > 0) {
    const requestedStacks = [...input.stacks];
    const resolvedStacks = resolveStacks(requestedStacks);
    const skills = resolveStackSkills(requestedStacks);
    const mcpServers = resolveStackMcpServers(requestedStacks);

    return input.json
      ? toJson({ requestedStacks, resolvedStacks, skills, mcpServers })
      : [
          section("Stacks", resolvedStacks),
          section("Skills", skills),
          section("MCP", mcpServers),
        ].join("\n\n");
  }

  const resolved = resolveAgnoxConfig(await loadAgnoxConfig(input.cwd));

  if (input.json) {
    return toJson(resolved);
  }

  return [
    "Agnox configuration",
    section("Profile", [resolved.profile]),
    section("Targets", resolved.targets),
    section("Stacks", resolved.resolvedStacks),
    section("Skills", resolved.skills),
    section("MCP", resolved.mcpServers),
  ].join("\n\n");
}

export function createResolveCommand(): Command {
  return new Command("resolve")
    .description("Resolve the stack and skill composition for this project.")
    .argument("[stacks...]", "resolve these stacks instead of the ones in .agnox.json")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (stacks: string[], options: { json: boolean }) => {
      await emit(() => runResolveCommand({ stacks, json: options.json, cwd: process.cwd() }));
    });
}
