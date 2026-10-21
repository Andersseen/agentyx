import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReportModel } from "../src/report/model.js";
import {
  addLocalSkill,
  cleanupProjects,
  fullConfig,
  reportProject,
  sync,
} from "./report-helpers.js";

afterEach(cleanupProjects);

describe("report model", () => {
  it("describes a converged project with a matching lock", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const model = await buildReportModel(cwd);

    expect(model.schemaVersion).toBe(1);
    expect(model.project).toMatchObject({ name: "Report Web", id: "report-web", relationCount: 1 });
    expect(model.overview.readiness.installation).toBe("ready");
    expect(model.overview.reproducibility).toBe("matching");
    expect(model.reproducibility).toMatchObject({
      lock: "present",
      lockVersion: 2,
      snapshot: "complete",
      differences: [],
    });
    expect(model.overview.targets).toEqual(["codex", "claude"]);
    expect(model.providers.map((provider) => provider.id)).toEqual(["codex", "claude"]);
    expect(model.installation.entries.length).toBeGreaterThan(0);
    expect(model.installation.entries.every((entry) => entry.state === "recorded")).toBe(true);
  });

  it("covers all five capability kinds with provenance", async () => {
    const cwd = await reportProject(fullConfig);
    const model = await buildReportModel(cwd);
    const kinds = new Set(model.harness.map((entry) => entry.kind));

    expect(kinds).toContain("skill");
    expect(kinds).toContain("mcp");
    expect(kinds).toContain("tool");
    expect(kinds).toContain("hook");
    expect(
      model.harness.find((entry) => entry.kind === "skill" && entry.packs.length > 0),
    ).toBeDefined();
    expect(model.overview.active.skill).toBeGreaterThan(0);
  });

  it("reports incomplete installation and a missing lock without failing", async () => {
    const cwd = await reportProject(fullConfig);
    const model = await buildReportModel(cwd);

    expect(model.overview.readiness.installation).toBe("not-ready");
    expect(model.overview.reproducibility).toBe("missing-lock");
    expect(model.reproducibility).toMatchObject({ lock: "absent", snapshot: "unavailable" });
    expect(model.installation.entries).toEqual([]);
  });

  it("reports a v1 lock as legacy", async () => {
    const cwd = await reportProject(fullConfig);
    await writeFile(join(cwd, ".agentyx.lock.json"), JSON.stringify({ version: 1, entries: [] }));
    const model = await buildReportModel(cwd);

    expect(model.overview.reproducibility).toBe("legacy-lock");
    expect(model.reproducibility).toMatchObject({ lockVersion: 1, snapshot: "unavailable" });
  });

  it("reports a v2 lock without a snapshot", async () => {
    const cwd = await reportProject(fullConfig);
    await writeFile(
      join(cwd, ".agentyx.lock.json"),
      JSON.stringify({ version: 2, entries: [], resolution: null }),
    );
    const model = await buildReportModel(cwd);

    expect(model.overview.reproducibility).toBe("snapshot-unavailable");
    expect(model.reproducibility.snapshot).toBe("unavailable");
  });

  it("reports an unreadable lock calmly", async () => {
    const cwd = await reportProject(fullConfig);
    await writeFile(join(cwd, ".agentyx.lock.json"), "{ not json");
    const model = await buildReportModel(cwd);

    expect(model.reproducibility.lock).toBe("unreadable");
    expect(model.overview.reproducibility).toBe("unavailable");
  });

  it("lists safe differences when inputs changed since the lock", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    await writeFile(
      join(cwd, ".agentyx.json"),
      JSON.stringify({ ...fullConfig, targets: ["codex", "claude", "kimi"] }),
    );
    const model = await buildReportModel(cwd);

    expect(model.overview.reproducibility).toBe("mismatch");
    expect(model.reproducibility.differences.length).toBeGreaterThan(0);
    expect(JSON.stringify(model.reproducibility.differences)).not.toMatch(/sha256|[0-9a-f]{40}/);
    // Locked mismatch is not an error of Doctor's own status.
    expect(model.overview.doctorStatus).not.toBe("errors");
  });

  it("explains excluded and optional-disabled capabilities", async () => {
    const cwd = await reportProject({
      ...fullConfig,
      exclude: { skills: ["code-quality"] },
    });
    const model = await buildReportModel(cwd);
    const excluded = model.harness.find((entry) => entry.name === "code-quality");

    expect(excluded).toMatchObject({ kind: "skill", active: false, reason: "excluded" });
    expect(model.desired.excluded).toContainEqual({ kind: "skill", name: "code-quality" });
    expect(model.harness.some((entry) => entry.reason === "optional-disabled")).toBe(true);
  });

  it("marks the project-context Skill", async () => {
    const cwd = await reportProject(fullConfig);
    const model = await buildReportModel(cwd);
    const context = model.harness.find((entry) => entry.reason === "project-context");

    expect(context).toMatchObject({ kind: "skill", active: true, projectContext: true });
    expect(model.desired.projectContext).toBe(true);
  });

  it("includes the graph SVG when configured and a calm state when not", async () => {
    const withGraph = await buildReportModel(await reportProject(fullConfig));
    const without = await buildReportModel(
      await reportProject({ packs: ["technical"], targets: ["codex"] }),
    );

    expect(withGraph.graph.svg).toMatch(/^<svg /);
    expect(withGraph.graph.relations).toBe(1);
    expect(without.graph.svg).toBeUndefined();
    expect(without.project.name).toBeUndefined();
  });

  it("includes an entry per configured target", async () => {
    const cwd = await reportProject({ ...fullConfig, targets: ["codex", "claude", "kimi"] });
    const model = await buildReportModel(cwd);

    expect(model.providers.map((provider) => provider.id)).toEqual(["codex", "claude", "kimi"]);
    expect(model.providers.every((provider) => provider.known)).toBe(true);
    expect(model.harness[0]?.targets.map((item) => item.target)).toEqual([
      "codex",
      "claude",
      "kimi",
    ]);
  });

  it("derives ownership from manifest entries only, never from the resolution", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const lock = JSON.parse(await readFile(join(cwd, ".agentyx.lock.json"), "utf8"));
    const before = await buildReportModel(cwd);
    const recorded = before.installation.entries.map((entry) => entry.path);

    // Drop one entry from the manifest: the file is still on disk and still resolved.
    const dropped = lock.entries.find((entry: { kind: string }) => entry.kind === "skill");
    lock.entries = lock.entries.filter((entry: unknown) => entry !== dropped);
    await writeFile(join(cwd, ".agentyx.lock.json"), JSON.stringify(lock));
    const after = await buildReportModel(cwd);

    expect(recorded).toContain(dropped.path);
    expect(after.installation.entries.map((entry) => entry.path)).not.toContain(dropped.path);
    expect(after.harness.some((entry) => entry.name === dropped.skill && entry.active)).toBe(true);
  });

  it("flags recorded files that are missing or edited", async () => {
    const cwd = await reportProject(fullConfig);
    await sync(cwd);
    const entries = (await buildReportModel(cwd)).installation.entries;
    const skills = entries.filter((entry) => entry.kind === "skill");
    const [gone, edited] = [skills[0], skills[1]];
    if (gone === undefined || edited === undefined) throw new Error("fixture needs two Skills");
    await rm(join(cwd, gone.path));
    await writeFile(join(cwd, edited.path), "edited by hand\n");
    const after = (await buildReportModel(cwd)).installation.entries;

    expect(after.find((entry) => entry.path === gone.path)?.state).toBe("missing");
    expect(after.find((entry) => entry.path === edited.path)?.state).toBe("drifted");
  });

  it("includes local Skills without their bodies", async () => {
    const cwd = await reportProject({
      ...fullConfig,
      skillDirectories: ["local-skills"],
      localPacks: [{ name: "local-pack", skills: ["local-skill"] }],
      packs: ["technical", "local-pack"],
    });
    await addLocalSkill(cwd, "local-skill");
    const model = await buildReportModel(cwd);

    expect(model.harness.find((entry) => entry.name === "local-skill")?.packs).toContain(
      "local-pack",
    );
    expect(JSON.stringify(model)).not.toContain("SECRET-SKILL-BODY-MARKER");
  });

  it("requires a valid configuration", async () => {
    const cwd = await reportProject({ packs: "nope" });

    await expect(buildReportModel(cwd)).rejects.toMatchObject({
      name: expect.stringMatching(/Config/),
    });
  });

  it("keeps machine paths out of diagnostics", async () => {
    const cwd = await reportProject({ ...fullConfig, targets: ["codex"] });
    await writeFile(join(cwd, "package.json"), "{ broken");
    const model = await buildReportModel(cwd);

    expect(JSON.stringify(model)).not.toContain(cwd);
  });
});
