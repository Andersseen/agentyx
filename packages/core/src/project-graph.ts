import type { ProjectMetadata, ProjectRelation } from "./config/schema.js";
import { AgentyxError } from "./errors.js";

export class ProjectGraphNotConfiguredError extends AgentyxError {
  constructor() {
    super(
      "project_graph_not_configured",
      "Project Graph requires a project object in .agentyx.json.",
    );
    this.name = "ProjectGraphNotConfiguredError";
  }
}

export interface ProjectGraph {
  readonly project: ProjectMetadata;
  readonly relations: readonly ProjectRelation[];
}

export function createProjectGraph(
  project: ProjectMetadata,
  relations: readonly ProjectRelation[],
): ProjectGraph {
  return { project, relations: [...relations] };
}

export function renderProjectGraphText(graph: ProjectGraph): string {
  const rows = graph.relations.map((relation, index) => {
    const branch = index === graph.relations.length - 1 ? "└──" : "├──";
    return `${branch} ${relation.type} [${relation.role}] → ${relation.name}`;
  });
  return [graph.project.name, ...rows].join("\n");
}

export function renderProjectGraphJson(graph: ProjectGraph): string {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

export function renderProjectGraphMermaid(graph: ProjectGraph): string {
  const current = mermaidId(graph.project.id);
  const rows = graph.relations.map(
    (relation) =>
      `  ${current}["${mermaidText(graph.project.name)}"] -->|${mermaidText(`${relation.type}: ${relation.role}`)}| ${mermaidId(relation.id)}["${mermaidText(relation.name)}"]`,
  );
  return ["graph LR", ...rows].join("\n");
}

export function renderProjectGraphSvg(graph: ProjectGraph): string {
  const width = 720;
  const rowHeight = 92;
  const height = Math.max(180, 100 + graph.relations.length * rowHeight);
  const centerX = 360;
  const centerY = height / 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${xml(graph.project.name)} project graph</title>`,
    `<desc id="desc">Direct architectural relationships from ${xml(graph.project.name)}.</desc>`,
    '<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#526579"/></marker></defs>',
  ];
  graph.relations.forEach((relation, index) => {
    const y = 54 + index * rowHeight;
    const right = index % 2 === 0;
    const x = right ? 500 : 0;
    const edgeStart = right ? centerX + 128 : centerX - 128;
    const edgeEnd = right ? x : x + 220;
    svg.push(
      `<line x1="${edgeStart}" y1="${centerY}" x2="${edgeEnd}" y2="${y + 24}" stroke="#526579" stroke-width="2" marker-end="url(#arrow)"/>`,
    );
    svg.push(
      `<text x="${right ? 494 : 226}" y="${Math.round((centerY + y + 24) / 2) - 7}" class="edge">${xml(truncate(`${relation.type} · ${relation.role}`, 34))}</text>`,
    );
    svg.push(`<rect x="${x}" y="${y}" width="220" height="48" rx="10" class="node"/>`);
    svg.push(
      `<text x="${x + 110}" y="${y + 30}" class="label">${xml(truncate(relation.name, 22))}</text>`,
    );
  });
  svg.push(
    `<rect x="${centerX - 128}" y="${centerY - 34}" width="256" height="68" rx="14" class="current"/>`,
  );
  svg.push(
    `<text x="${centerX}" y="${centerY + 6}" class="label">${xml(truncate(graph.project.name, 30))}</text>`,
  );
  svg.push(
    "<style>text{font-family:system-ui,sans-serif}.node{fill:#fff;stroke:#8da0b3;stroke-width:2}.current{fill:#e8f2ff;stroke:#2563a5;stroke-width:3}.label{text-anchor:middle;font-size:16px;font-weight:600;fill:#172536}.edge{text-anchor:middle;font-size:12px;fill:#34495e;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}</style>",
  );
  svg.push("</svg>");
  return `${svg.join("\n")}\n`;
}

export function findProjectCapabilityOwners(graph: ProjectGraph, capability: string) {
  const owners = graph.relations.filter((relation) => relation.owns.includes(capability));
  return {
    capability,
    currentProject: graph.project.owns.includes(capability) ? graph.project : undefined,
    relatedProjects: owners,
  };
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function mermaidText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("|", "&#124;")
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mermaidId(value: string): string {
  return `node_${Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16) ?? "0")
    .join("")}`;
}

function truncate(value: string, limit: number): string {
  const characters = Array.from(value);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join("")}…` : value;
}
