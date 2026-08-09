import {
  AGENTYX_PROFILES,
  type AgentyxProfile,
  DEFAULT_AGENTYX_PROFILE,
  filterEffectiveMcpServers,
  loadAgentyxConfig,
  resolveAgentyxConfig,
  resolveStackMcpServerReferences,
  resolveStackSkills,
  resolveStacks,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface ResolveCommandInput {
  /**
   * Stacks passed on the command line. When present they replace the stacks
   * from `.agentyx.json`, and the project configuration is not read at all.
   */
  readonly stacks: readonly string[];
  readonly profile?: AgentyxProfile;
  readonly json: boolean;
  readonly cwd: string;
}

/**
 * Produces the exact text `agentyx resolve` writes to stdout. Kept free of
 * terminal side effects so the behaviour can be tested directly.
 *
 * Only skill identifiers are printed — `agentyx skill show` is what reads the
 * instructions.
 */
export async function runResolveCommand(input: ResolveCommandInput): Promise<string> {
  if (input.stacks.length > 0) {
    const requestedStacks = [...input.stacks];
    const profile = input.profile ?? DEFAULT_AGENTYX_PROFILE;
    const resolvedStacks = resolveStacks(requestedStacks);
    const skills = resolveStackSkills(requestedStacks);
    const declaredMcpServers = resolveStackMcpServerReferences(requestedStacks);
    const mcpServers = filterEffectiveMcpServers(declaredMcpServers, profile);

    return input.json
      ? toJson({ requestedStacks, resolvedStacks, skills, declaredMcpServers, mcpServers, profile })
      : [
          section("Profile", [profile]),
          section("Stacks", resolvedStacks),
          section("Skills", skills),
          section("MCP", renderMcpLines(declaredMcpServers, mcpServers)),
        ].join("\n\n");
  }

  const config = await loadAgentyxConfig(input.cwd);
  const resolved = resolveAgentyxConfig({
    ...config,
    profile: input.profile ?? config.profile,
  });

  if (input.json) {
    return toJson(resolved);
  }

  return [
    "Agentyx configuration",
    section("Profile", [resolved.profile]),
    section("Targets", resolved.targets),
    section("Stacks", resolved.resolvedStacks),
    section("Skills", resolved.skills),
    section("MCP", renderMcpLines(resolved.declaredMcpServers, resolved.mcpServers)),
  ].join("\n\n");
}

function renderMcpLines(
  declaredMcpServers: readonly { readonly name: string; readonly level: string }[],
  effectiveMcpServers: readonly string[],
): string[] {
  const effective = new Set(effectiveMcpServers);

  return declaredMcpServers.map((server) =>
    effective.has(server.name)
      ? `${server.name}    ${server.level}`
      : `${server.name}    skipped (${server.level})`,
  );
}

export function createResolveCommand(): Command {
  return new Command("resolve")
    .description("Resolve the stack and skill composition for this project.")
    .argument("[stacks...]", "resolve these stacks instead of the ones in .agentyx.json")
    .option("--profile <profile>", "override the optimization profile for this run", (value) => {
      if (!AGENTYX_PROFILES.includes(value as AgentyxProfile)) {
        throw new Error(`Profile must be one of: ${AGENTYX_PROFILES.join(", ")}.`);
      }

      return value as AgentyxProfile;
    })
    .option("--json", "print machine-readable JSON only", false)
    .action(async (stacks: string[], options: { profile?: AgentyxProfile; json: boolean }) => {
      await emit(() =>
        runResolveCommand(
          options.profile === undefined
            ? {
                stacks,
                json: options.json,
                cwd: process.cwd(),
              }
            : {
                stacks,
                profile: options.profile,
                json: options.json,
                cwd: process.cwd(),
              },
        ),
      );
    });
}
