import { describe, expect, it } from "vitest";
import { parseAgentyxConfig } from "../src/config/loader.js";
import {
  createProjectGraph,
  renderProjectGraphJson,
  renderProjectGraphMermaid,
  renderProjectGraphSvg,
  renderProjectGraphText,
} from "../src/project-graph.js";

describe("project graph projections", () => {
  const config = parseAgentyxConfig({
    project: { id: "web", name: 'Web "<app>' },
    relations: [
      {
        id: "api",
        name: "API | service",
        type: "consumes",
        role: "backend-api",
        owns: ["authentication"],
      },
    ],
  });
  if (config.project === undefined) throw new Error("test fixture project missing");
  const graph = createProjectGraph(config.project, config.relations ?? []);

  it("renders deterministic text and JSON", () => {
    expect(renderProjectGraphText(graph)).toContain("└── consumes [backend-api] → API | service");
    expect(renderProjectGraphJson(graph)).toBe(renderProjectGraphJson(graph));
  });

  it("escapes Mermaid and SVG text", () => {
    const mermaid = renderProjectGraphMermaid(graph);
    const svg = renderProjectGraphSvg(graph);
    expect(mermaid).toContain("Web &quot;&lt;app&gt;");
    expect(mermaid).toContain("API &#124; service");
    expect(svg).toContain("Web &quot;&lt;app&gt;");
    expect(svg).toContain("API | service");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[\s\S]*<\/svg>\n$/);
    expect(svg).toBe(renderProjectGraphSvg(graph));
  });

  it("keeps hostile labels from breaking out of the SVG when it is embedded in HTML", () => {
    const hostile = [
      "</script><script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      '"><svg onload=alert(1)>',
    ];
    const config = parseAgentyxConfig({
      project: { id: "evil", name: hostile[0] },
      relations: hostile.map((name, index) => ({
        id: `evil-${index}`,
        name,
        type: "uses",
        role: "backend-api",
      })),
    });
    if (config.project === undefined) throw new Error("test fixture project missing");
    const svg = renderProjectGraphSvg(createProjectGraph(config.project, config.relations ?? []));
    const markup = svg.replace(/<style>[\s\S]*?<\/style>/, "");

    expect(markup).not.toMatch(/<script|<img|<svg onload/i);
    expect(markup.match(/<svg/g)).toHaveLength(1);
    expect(markup).toContain("&lt;/script&gt;");
  });
});
