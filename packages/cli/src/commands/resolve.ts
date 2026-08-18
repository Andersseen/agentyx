import { loadAgentyxProject, resolveAgentyxConfig } from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface ResolveCommandInput {
  readonly packs: readonly string[];
  readonly enable?: readonly string[];
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
  if (input.packs.length > 0) {
    const resolved = resolveAgentyxConfig({
      packs: [...input.packs],
      enable: [...(input.enable ?? [])],
      targets: [],
    });

    return input.json
      ? toJson(resolved)
      : [
          section("Packs", resolved.resolvedPacks),
          section("Skills", resolved.skills),
          section("MCP", renderMcpLines(resolved.declaredMcpServers, resolved.mcpServers)),
          section("Tools", renderToolLines(resolved.declaredTools, resolved.tools)),
        ].join("\n\n");
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

  if (input.json) {
    return toJson(resolved);
  }

  return [
    "Agentyx configuration",
    section("Targets", resolved.targets),
    section("Packs", resolved.resolvedPacks),
    section("Skills", resolved.skills),
    section("MCP", renderMcpLines(resolved.declaredMcpServers, resolved.mcpServers)),
    section("Tools", renderToolLines(resolved.declaredTools, resolved.tools)),
  ].join("\n\n");
}

function renderMcpLines(
  declaredMcpServers: readonly { readonly name: string; readonly activation: string }[],
  effectiveMcpServers: readonly string[],
): string[] {
  const effective = new Set(effectiveMcpServers);

  return declaredMcpServers.map((server) =>
    effective.has(server.name)
      ? `${server.name}    ${server.activation}`
      : `${server.name}    disabled (${server.activation})`,
  );
}

function renderToolLines(
  declaredTools: readonly { readonly name: string; readonly activation: string }[],
  effectiveTools: readonly string[],
): string[] {
  const effective = new Set(effectiveTools);

  return declaredTools.map((tool) =>
    effective.has(tool.name)
      ? `${tool.name}    ${tool.activation}`
      : `${tool.name}    disabled (${tool.activation})`,
  );
}

function collectName(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function createResolveCommand(): Command {
  return new Command("resolve")
    .description("Resolve the pack and capability composition for this project.")
    .argument("[packs...]", "resolve these packs instead of the ones in .agentyx.json")
    .option(
      "--enable <id>",
      "enable an optional capability for this run; repeatable",
      collectName,
      [],
    )
    .option("--json", "print machine-readable JSON only", false)
    .action(async (packs: string[], options: { enable: string[]; json: boolean }) => {
      await emit(() =>
        runResolveCommand({
          packs,
          enable: options.enable,
          json: options.json,
          cwd: process.cwd(),
        }),
      );
    });
}
