import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runResolveCommand } from "../src/commands/resolve.js";

describe("agentyx resolve --explain", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agentyx-explain-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("explains an explicit pack composition without touching the project", async () => {
    await writeFile(join(dir, ".agentyx.json"), JSON.stringify({ packs: ["angular"] }));
    const output = await runResolveCommand({
      packs: ["testing"],
      explain: true,
      json: false,
      cwd: dir,
    });

    expect(output).toContain("playwright\n    inactive · optional\n    from testing");
    expect(output).toContain("reason: not explicitly enabled");
    expect(output).not.toContain("angular");
  });

  it("applies --enable and explains agents", async () => {
    const output = await runResolveCommand({
      packs: ["agentic"],
      enable: ["agentyx-reviewer"],
      explain: true,
      json: false,
      cwd: dir,
    });

    expect(output).toContain("agentyx-reviewer\n    active · explicitly enabled\n    from agentic");
    expect(output).toContain("agentyx-planner\n    inactive · optional");
  });

  it("explains project configuration with local packs and project context", async () => {
    await writeFile(
      join(dir, ".agentyx.json"),
      JSON.stringify({
        packs: ["local-one", "technical"],
        project: { id: "web", name: "Web" },
        localPacks: [
          { name: "local-one", mcpServers: [{ name: "playwright", activation: "optional" }] },
        ],
      }),
    );
    const output = await runResolveCommand({ packs: [], explain: true, json: false, cwd: dir });

    expect(output).toContain("playwright\n    inactive · optional\n    from local-one");
    expect(output).toContain("agentyx-project-context\n    active · project context");
    expect(output).toContain("code-quality\n    active · default\n    from technical");
  });

  it("wraps the unchanged resolution in JSON and leaks no content", async () => {
    const plain = JSON.parse(
      await runResolveCommand({ packs: ["agentic", "testing"], json: true, cwd: dir }),
    );
    const explained = JSON.parse(
      await runResolveCommand({
        packs: ["agentic", "testing"],
        explain: true,
        json: true,
        cwd: dir,
      }),
    );

    expect(Object.keys(plain)).not.toContain("explanation");
    expect(explained.resolution).toEqual(plain);
    expect(Object.keys(explained).sort()).toEqual(["explanation", "resolution"]);
    expect(explained.explanation.length).toBeGreaterThan(0);

    for (const entry of explained.explanation) {
      expect(Object.keys(entry).sort()).toEqual([
        "activation",
        "active",
        "kind",
        "name",
        "origins",
        "reason",
      ]);
    }
  });

  it("leaves plain resolve output unchanged", async () => {
    const output = await runResolveCommand({ packs: ["testing"], json: false, cwd: dir });

    expect(output).not.toContain("inactive");
    expect(output).toContain("playwright    disabled (optional)");
  });

  it("explains exclusions and retains shared origins", async () => {
    await writeFile(
      join(dir, ".agentyx.json"),
      JSON.stringify({ packs: ["testing", "ui-ux"], exclude: { mcpServers: ["playwright"] } }),
    );
    const output = await runResolveCommand({ packs: [], explain: true, json: false, cwd: dir });
    expect(output).toContain("playwright\n    inactive · excluded\n    from testing, ui-ux");

    const plain = await runResolveCommand({ packs: [], json: false, cwd: dir });
    expect(plain).toContain("playwright    excluded (optional)");
  });
});
