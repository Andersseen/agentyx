import { realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  AgentyxError,
  loadAgentyxProject,
  ProjectGraphNotConfiguredError,
  renderProjectGraphJson,
  renderProjectGraphMermaid,
  renderProjectGraphSvg,
  renderProjectGraphText,
} from "@agentyx/core";
import { Command } from "commander";
import { emit } from "../output.js";

type GraphFormat = "text" | "json" | "mermaid" | "svg";

export interface GraphCommandInput {
  readonly cwd: string;
  readonly format: GraphFormat;
  readonly output?: string;
}

export async function runGraphCommand(input: GraphCommandInput): Promise<string> {
  const project = await loadAgentyxProject(input.cwd);
  const graph = project.graph;
  if (graph === undefined) throw new ProjectGraphNotConfiguredError();
  const rendered =
    input.format === "json"
      ? renderProjectGraphJson(graph)
      : input.format === "mermaid"
        ? renderProjectGraphMermaid(graph)
        : input.format === "svg"
          ? renderProjectGraphSvg(graph)
          : renderProjectGraphText(graph);
  if (input.output === undefined) {
    if (input.format === "svg") throw new GraphOutputError("SVG output requires --output <path>.");
    return rendered;
  }
  if (input.format !== "svg")
    throw new GraphOutputError("--output is supported only with --format svg.");
  await writeSvg(input.cwd, input.output, rendered);
  return `Wrote ${input.output}`;
}

async function writeSvg(cwd: string, output: string, content: string): Promise<void> {
  if (isAbsolute(output)) throw new GraphOutputError("Output path must be project-relative.");
  const project = await realpath(cwd);
  const destination = resolve(cwd, output);
  let parent: string;
  try {
    parent = await realpath(resolve(destination, ".."));
  } catch (cause) {
    throw new GraphOutputError(
      `Output directory for ${output} does not exist or cannot be read: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const rel = relative(project, parent);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new GraphOutputError("Output path must stay inside the project.");
  }
  try {
    await writeFile(destination, content, { encoding: "utf8", flag: "wx" });
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "EEXIST") {
      throw new GraphOutputError(`Output file already exists: ${output}`);
    }
    throw new GraphOutputError(
      `Could not write ${output}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

class GraphOutputError extends AgentyxError {
  constructor(message: string) {
    super("project_graph_output_error", message);
    this.name = "GraphOutputError";
  }
}

export function createGraphCommand(): Command {
  const graph = new Command("graph")
    .description("Show this project's direct architectural relationships.")
    .option("--format <format>", "text, json, mermaid, or svg", "text")
    .option("--json", "print machine-readable JSON", false)
    .option("--output <path>", "write SVG to a new project-relative file")
    .action(async (options: { format: string; json: boolean; output?: string }) => {
      const format = options.json ? "json" : options.format;
      await emit(() => {
        if (!(["text", "json", "mermaid", "svg"] as const).includes(format as GraphFormat)) {
          throw new GraphOutputError(`Unknown graph format "${format}".`);
        }
        return runGraphCommand({
          cwd: process.cwd(),
          format: format as GraphFormat,
          ...(options.output === undefined ? {} : { output: options.output }),
        });
      });
    });

  graph
    .command("show")
    .description("Show details for one related project.")
    .argument("<id>", "related project identifier")
    .option("--json", "print machine-readable JSON", false)
    .action(async (id: string, options: { json: boolean }) => {
      await emit(async () => {
        const project = await loadAgentyxProject();
        const relation = (project.config.relations ?? []).find((item) => item.id === id);
        if (relation === undefined) throw new GraphOutputError(`Unknown related project "${id}".`);
        return options.json ? `${JSON.stringify(relation, null, 2)}\n` : renderRelation(relation);
      });
    });

  graph
    .command("owner")
    .description("Find projects that declare ownership of a capability.")
    .argument("<capability>", "capability identifier")
    .option("--json", "print machine-readable JSON", false)
    .action(async (capability: string, options: { json: boolean }) => {
      await emit(async () => {
        const project = await loadAgentyxProject();
        if (project.graph === undefined) throw new ProjectGraphNotConfiguredError();
        const current = project.graph.project.owns.includes(capability)
          ? [project.graph.project]
          : [];
        const related = project.graph.relations.filter((item) => item.owns.includes(capability));
        const result = { capability, currentProject: current, relatedProjects: related };
        if (options.json) return `${JSON.stringify(result, null, 2)}\n`;
        if (current.length === 0 && related.length === 0) {
          return `${capability}\nNo configured project declares ownership.`;
        }
        const lines = [capability];
        for (const owner of current) lines.push(`\n${owner.name}\n  current project`);
        for (const owner of related)
          lines.push(
            `\n${owner.name}\n  relationship: ${owner.type}\n  role: ${owner.role}${owner.repository ? `\n  repository: ${owner.repository}` : ""}`,
          );
        return lines.join("\n");
      });
    });
  return graph;
}

function renderRelation(relation: import("@agentyx/core").ProjectRelation): string {
  return [
    relation.name,
    "",
    "Relationship",
    `  ${relation.type}`,
    "",
    "Role",
    `  ${relation.role}`,
    ...(relation.owns.length ? ["", "Owns", ...relation.owns.map((item) => `  ${item}`)] : []),
    ...(relation.repository ? ["", "Repository", `  ${relation.repository}`] : []),
    ...(relation.docs.length ? ["", "Docs", ...relation.docs.map((item) => `  ${item}`)] : []),
    ...(relation.mcp.length ? ["", "MCP", ...relation.mcp.map((item) => `  ${item}`)] : []),
    ...(relation.guidance.length
      ? ["", "Guidance", ...relation.guidance.map((item) => `  ${item}`)]
      : []),
  ].join("\n");
}
