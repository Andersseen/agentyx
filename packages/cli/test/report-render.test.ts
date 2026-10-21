import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReportModel } from "../src/report/model.js";
import { renderReportHtml } from "../src/report/render.js";
import { cleanupProjects, fullConfig, reportProject, sync } from "./report-helpers.js";

afterEach(cleanupProjects);

const html = async (cwd: string) => renderReportHtml(await buildReportModel(cwd));

const PAYLOADS = [
  "</script><script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  '"><svg onload=alert(1)>',
];

/** Everything except the template's own <script> and the Agentyx-generated graph SVG. */
function untrustedMarkup(document: string): string {
  return document
    .replace(/<script>[\s\S]*?<\/script>(?=\s*<\/body>)/, "")
    .replace(/<div class="graph-frame">[\s\S]*?<\/svg>\s*<\/div>/, "");
}

describe("report renderer", () => {
  it("renders the major sections, readiness and reproducibility", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const document = await html(cwd);

    expect(document.startsWith("<!doctype html>")).toBe(true);
    for (const heading of [
      "Overview",
      "Harness",
      "Providers",
      "Readiness",
      "Reproducibility",
      "Installation",
      "Project graph",
    ]) {
      expect(document).toMatch(new RegExp(`<h2 id="h-[a-z]+">${heading}</h2>`));
    }
    expect(document).toContain("Report Web");
    expect(document).toContain("Codex");
    expect(document).toContain("Claude");
    expect(document).toContain("Matching");
    expect(document).toContain("Locked resolution");
    expect(document).toContain("Ready");
  });

  it("shows provenance and selection state for capabilities", async () => {
    const cwd = await reportProject({ ...fullConfig, exclude: { skills: ["code-quality"] } });
    const document = await html(cwd);

    expect(document).toMatch(/data-capability data-kind="skill" data-state="excluded"/);
    expect(document).toMatch(/data-capability data-kind="skill" data-state="selected"/);
    expect(document).toContain("pack technical");
    expect(document).toContain("Removed by an exclusion");
    expect(document).toContain("project context");
    expect(document).toMatch(/data-search="[^"]*code-quality[^"]*"/);
  });

  it("does not present a not-ready installation as healthy", async () => {
    const cwd = await reportProject(fullConfig);
    const document = await html(cwd);

    expect(document).toContain("Not ready");
    expect(document).toContain("No lock");
    expect(document).toContain("The lock records no Agentyx-owned files.");
  });

  it("lists reproducibility differences in words", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    await writeFile(
      join(cwd, ".agentyx.json"),
      JSON.stringify({ ...fullConfig, targets: ["codex", "claude", "kimi"] }),
    );
    const document = await html(cwd);

    expect(document).toContain("Differences from the lock");
    expect(document).toContain("configuration changed");
  });

  it("renders a graph when configured and a calm state when not", async () => {
    const withGraph = await html(await reportProject(fullConfig));
    const without = await html(await reportProject({ packs: ["technical"], targets: ["codex"] }));

    expect(withGraph).toContain('<div class="graph-frame"><svg');
    expect(without).toContain("Project graph not configured.");
    expect(without).not.toContain("<svg");
    expect(without).toContain("Unnamed project");
  });

  it("escapes project-controlled text and never emits attacker markup", async () => {
    for (const payload of PAYLOADS) {
      const cwd = await reportProject({
        ...fullConfig,
        targets: ["codex", payload],
        project: { id: "evil", name: payload, description: payload, owns: ["frontend"] },
        relations: [{ id: "evil-api", name: payload, type: "uses", role: "backend-api" }],
      });
      const untrusted = untrustedMarkup(await html(cwd));

      expect(untrusted).not.toContain(payload);
      expect(untrusted).not.toMatch(/<img src=x/);
      expect(untrusted).not.toMatch(/<svg onload/);
      expect(untrusted).not.toMatch(/<script>alert/);
      expect(untrusted).toContain(
        payload
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;"),
      );
    }
  });

  it("embeds a graph SVG that cannot break out of its container", async () => {
    const payload = PAYLOADS[0] ?? "";
    const cwd = await reportProject({
      ...fullConfig,
      project: { id: "evil", name: payload, owns: [] },
      relations: [{ id: "evil-api", name: PAYLOADS[1] ?? "", type: "uses", role: "backend-api" }],
    });
    const document = await html(cwd);

    expect(document.match(/<script/g)?.length).toBe(1);
    expect(document).not.toContain("<img src=x");
    expect(document).not.toContain("onload=alert(1)>");
  });

  it("is a single offline document without external resources", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const document = await html(cwd);
    const withoutNamespaces = document.replaceAll("http://www.w3.org/2000/svg", "");

    expect(withoutNamespaces).not.toMatch(/https?:\/\//);
    expect(document).not.toMatch(/<link\b/);
    expect(document).not.toMatch(/<script[^>]*\ssrc=/);
    expect(document).not.toMatch(/<iframe|<object|<embed/);
    expect(document).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|window\.__REPORT__/);
    expect(document).toContain("default-src 'none'");
    expect(document).toContain("connect-src 'none'");
  });

  it("keeps secrets, bodies, hashes and paths out", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const document = await html(cwd);

    expect(document).not.toContain(cwd);
    expect(document).not.toMatch(/sha256|[0-9a-f]{64}/);
    expect(document).not.toContain("SECRET-SKILL-BODY-MARKER");
    expect(document).not.toMatch(/"version": ?2|"entries"/);
  });

  it("is byte-identical for unchanged state", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);

    expect(await html(cwd)).toBe(await html(cwd));
  });

  it("reads without JavaScript: filters are hidden until a script reveals them", async () => {
    const document = await html(await reportProject(fullConfig));

    expect(document).toMatch(/id="harness-controls" hidden/);
    expect(document).toContain("<main");
    expect(document).toContain('aria-label="Report sections"');
    expect(document).toContain("prefers-reduced-motion");
    expect(document).toContain("prefers-color-scheme:dark");
  });
});
