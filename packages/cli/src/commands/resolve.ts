import {
  builtInPackRegistry,
  explainAgentyxResolution,
  loadAgentyxProject,
  type PackRegistry,
  type ResolutionExplanationEntry,
  type ResolvedAgentyxConfig,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export interface ResolveCommandInput {
  readonly packs: readonly string[];
  readonly enable?: readonly string[];
  readonly json: boolean;
  readonly explain?: boolean;
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
      relations: [],
    });

    if (input.explain === true) {
      return renderExplained(resolved, builtInPackRegistry, input.json, false);
    }

    return input.json
      ? toJson(resolved)
      : [
          section("Packs", resolved.resolvedPacks),
          section("Skills", resolved.skills),
          section(
            "MCP",
            renderMcpLines(
              resolved.declaredMcpServers,
              resolved.mcpServers,
              resolved.excluded.mcpServers,
            ),
          ),
          section(
            "Tools",
            renderToolLines(resolved.declaredTools, resolved.tools, resolved.excluded.tools),
          ),
          section(
            "Hooks",
            renderToolLines(resolved.declaredHooks, resolved.hooks, resolved.excluded.hooks),
          ),
          section(
            "Agents",
            renderToolLines(resolved.declaredAgents, resolved.agents, resolved.excluded.agents),
          ),
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

  if (input.explain === true) {
    return renderExplained(resolved, project.packRegistry, input.json, true);
  }

  if (input.json) {
    return toJson(resolved);
  }

  return [
    "Agentyx configuration",
    section("Targets", resolved.targets),
    section("Packs", resolved.resolvedPacks),
    section("Skills", resolved.skills),
    section(
      "MCP",
      renderMcpLines(
        resolved.declaredMcpServers,
        resolved.mcpServers,
        resolved.excluded.mcpServers,
      ),
    ),
    section(
      "Tools",
      renderToolLines(resolved.declaredTools, resolved.tools, resolved.excluded.tools),
    ),
    section(
      "Hooks",
      renderToolLines(resolved.declaredHooks, resolved.hooks, resolved.excluded.hooks),
    ),
    section(
      "Agents",
      renderToolLines(resolved.declaredAgents, resolved.agents, resolved.excluded.agents),
    ),
  ].join("\n\n");
}

const EXPLAIN_SECTIONS = [
  ["skill", "Skills"],
  ["mcp", "MCP"],
  ["tool", "Tools"],
  ["hook", "Hooks"],
  ["agent", "Agents"],
] as const;

function renderExplained(
  resolved: ResolvedAgentyxConfig,
  packRegistry: PackRegistry,
  json: boolean,
  configMode: boolean,
): string {
  const explanation = explainAgentyxResolution(resolved, packRegistry);

  if (json) {
    return toJson({ resolution: resolved, explanation });
  }

  return [
    configMode ? "Agentyx resolution (project configuration)" : "Agentyx resolution",
    ...EXPLAIN_SECTIONS.map(([kind, title]) =>
      section(
        title,
        explanation.filter((entry) => entry.kind === kind).flatMap(renderExplanationEntry),
      ),
    ),
  ].join("\n\n");
}

function renderExplanationEntry(entry: ResolutionExplanationEntry): string[] {
  const status = {
    default: "active · default",
    "explicitly-enabled": "active · explicitly enabled",
    "optional-disabled": "inactive · optional",
    excluded: "inactive · excluded",
    "project-context": "active · project context",
  }[entry.reason];
  const lines = [entry.name, `  ${status}`];
  const packs = entry.origins.flatMap((origin) => (origin.kind === "pack" ? [origin.name] : []));

  if (packs.length > 0) {
    lines.push(`  from ${packs.join(", ")}`);
  }

  if (entry.reason === "optional-disabled") {
    lines.push("  reason: not explicitly enabled");
  }

  return lines;
}

function renderMcpLines(
  declaredMcpServers: readonly { readonly name: string; readonly activation: string }[],
  effectiveMcpServers: readonly string[],
  excluded: readonly string[] = [],
): string[] {
  const effective = new Set(effectiveMcpServers);
  const excludedNames = new Set(excluded);

  return declaredMcpServers.map((server) =>
    effective.has(server.name)
      ? `${server.name}    ${server.activation}`
      : `${server.name}    ${excludedNames.has(server.name) ? "excluded" : "disabled"} (${server.activation})`,
  );
}

function renderToolLines(
  declaredTools: readonly { readonly name: string; readonly activation: string }[],
  effectiveTools: readonly string[],
  excluded: readonly string[] = [],
): string[] {
  const effective = new Set(effectiveTools);
  const excludedNames = new Set(excluded);

  return declaredTools.map((tool) =>
    effective.has(tool.name)
      ? `${tool.name}    ${tool.activation}`
      : `${tool.name}    ${excludedNames.has(tool.name) ? "excluded" : "disabled"} (${tool.activation})`,
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
    .option("--explain", "explain why each declared capability is active or inactive", false)
    .option("--json", "print machine-readable JSON only", false)
    .action(
      async (packs: string[], options: { enable: string[]; explain: boolean; json: boolean }) => {
        await emit(() =>
          runResolveCommand({
            packs,
            enable: options.enable,
            json: options.json,
            explain: options.explain,
            cwd: process.cwd(),
          }),
        );
      },
    );
}
