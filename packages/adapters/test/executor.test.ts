import { mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  formatSkillMarkdown,
  hashContent,
  loadInstallManifest,
  parseSkillMarkdown,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallPathError } from "../src/errors.js";
import { applyInstallPlan, applyInstallPlans } from "../src/executor.js";
import type { InstallOperation, InstallPlan } from "../src/plan.js";
import { planInstall, planTargetInstall, planUninstall } from "../src/planner.js";

const skills = ["planning", "verification"].map((name) => builtInSkillRegistry.get(name));

describe("applyInstallPlan", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-executor-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("writes the planned files, creating missing parents", async () => {
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });
    const result = await applyInstallPlan(plan);

    expect(result).toEqual({
      target: "codex",
      written: [".agents/skills/planning/SKILL.md", ".agents/skills/verification/SKILL.md"],
      unchanged: [],
      deleted: [],
      conflicts: [],
    });
    expect(await readdir(join(projectDir, ".agents", "skills"))).toEqual([
      "planning",
      "verification",
    ]);
  });

  it("writes valid, parseable skills", async () => {
    await applyInstallPlan(await planTargetInstall({ target: "codex", projectDir, skills }));

    const installed = await readFile(
      join(projectDir, ".agents", "skills", "planning", "SKILL.md"),
      "utf8",
    );

    expect(parseSkillMarkdown(installed, "SKILL.md")).toEqual(builtInSkillRegistry.get("planning"));
  });

  it("touches nothing outside the target directory", async () => {
    await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");

    await applyInstallPlan(await planTargetInstall({ target: "claude", projectDir, skills }));

    expect((await readdir(projectDir)).sort()).toEqual([".claude", "package.json"]);
    expect(await readFile(join(projectDir, "package.json"), "utf8")).toBe("{}\n");
  });

  it("leaves content edited since Agentyx wrote it alone", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex"], projectDir, skills }));

    const path = join(projectDir, ".agents", "skills", "planning", "SKILL.md");
    const edited = "---\nname: planning\ndescription: Edited\n---\n\nEdited.\n";
    await writeFile(path, edited, "utf8");

    const manifest = await loadInstallManifest(projectDir);
    const plan = await planTargetInstall({ target: "codex", projectDir, skills, manifest });
    expect(plan.operations[0]?.status).toBe("conflict");

    const result = await applyInstallPlan(plan);

    expect(result.conflicts).toEqual([".agents/skills/planning/SKILL.md"]);
    expect(await readFile(path, "utf8")).toBe(edited);
  });

  it("replaces its own unedited content deterministically", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex"], projectDir, skills }));

    const path = join(projectDir, ".agents", "skills", "planning", "SKILL.md");
    await writeFile(path, "---\nname: planning\ndescription: Edited\n---\n\nEdited.\n", "utf8");

    const manifest = await loadInstallManifest(projectDir);
    const plan = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest,
      force: true,
    });

    await applyInstallPlan(plan);

    expect(await readFile(path, "utf8")).toBe(
      formatSkillMarkdown(builtInSkillRegistry.get("planning")),
    );
  });

  it("does not rewrite unchanged files", async () => {
    await applyInstallPlan(await planTargetInstall({ target: "codex", projectDir, skills }));

    const path = join(projectDir, ".agents", "skills", "planning", "SKILL.md");
    const marker = new Date(Date.UTC(2020, 0, 1));
    await utimes(path, marker, marker);

    const plan = await planTargetInstall({ target: "codex", projectDir, skills });
    const result = await applyInstallPlan(plan);

    expect(result.written).toEqual([]);
    expect(result.unchanged).toHaveLength(2);
    expect((await stat(path)).mtime.getTime()).toBe(marker.getTime());
  });

  it("is idempotent", async () => {
    const first = await planTargetInstall({ target: "claude", projectDir, skills });
    await applyInstallPlan(first);
    const second = await planTargetInstall({ target: "claude", projectDir, skills });

    expect(second.operations.every((operation) => operation.status === "unchanged")).toBe(true);
  });

  it("rejects an operation outside the target directory", async () => {
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });
    const escaping: InstallOperation = {
      type: "write-file",
      status: "create",
      path: join(projectDir, "escaped.md"),
      relativePath: "escaped.md",
      skill: "planning",
      content: "nope",
      usedBy: ["codex"],
    };

    await expect(applyInstallPlan({ ...plan, operations: [escaping] })).rejects.toThrow(
      InstallPathError,
    );
    expect(await readdir(projectDir)).toEqual([]);
  });

  it("rejects a plan whose directory is outside the project", async () => {
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });
    const hostile: InstallPlan = { ...plan, skillsPath: tmpdir() };

    await expect(applyInstallPlan(hostile)).rejects.toThrow(InstallPathError);
  });

  it("rejects a symlinked target directory before writing", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "agentyx-outside-"));
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });

    try {
      await symlink(outsideDir, join(projectDir, ".agents"));

      const escaping: InstallPlan = {
        ...plan,
        skillsPath: join(projectDir, ".agents", "skills"),
        operations: plan.operations.map((operation) => ({
          ...operation,
          path: join(projectDir, ".agents", "skills", operation.skill, "SKILL.md"),
        })),
      };

      await expect(applyInstallPlan(escaping)).rejects.toThrow(InstallPathError);
      await expect(readdir(outsideDir)).resolves.toEqual([]);
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("reports the offending path on the error", async () => {
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });

    try {
      await applyInstallPlan({ ...plan, skillsPath: tmpdir() });
      expect.unreachable("expected an InstallPathError");
    } catch (error) {
      expect((error as InstallPathError).code).toBe("install_path_escape");
      expect((error as InstallPathError).path).toBe(tmpdir());
    }
  });
});

describe("applyInstallPlans", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-executor-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("installs shared skill destinations only once", async () => {
    const plans = await planInstall({ targets: ["codex", "kimi"], projectDir, skills });
    const results = await applyInstallPlans(plans);

    expect(results.map((result) => result.target)).toEqual(["codex", "kimi"]);
    expect(results[0]?.written).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);
    expect(results[1]?.written).toEqual([]);
    expect(results[1]?.unchanged).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);

    const forCodex = await readFile(
      join(projectDir, ".agents", "skills", "verification", "SKILL.md"),
      "utf8",
    );

    expect(forCodex).toBe(formatSkillMarkdown(builtInSkillRegistry.get("verification")));
  });

  it("installs the same skills for provider-specific destinations, from one source", async () => {
    const plans = await planInstall({ targets: ["codex", "claude"], projectDir, skills });
    const results = await applyInstallPlans(plans);

    expect(results.map((result) => result.target)).toEqual(["codex", "claude"]);

    const forCodex = await readFile(
      join(projectDir, ".agents", "skills", "verification", "SKILL.md"),
      "utf8",
    );
    const forClaude = await readFile(
      join(projectDir, ".claude", "skills", "verification", "SKILL.md"),
      "utf8",
    );

    expect(forCodex).toBe(forClaude);
    expect(forCodex).toBe(formatSkillMarkdown(builtInSkillRegistry.get("verification")));
  });
});

describe("applyInstallPlans manifest", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-manifest-exec-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("records every file it wrote, with the targets that share it", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex", "kimi"], projectDir, skills }));

    const manifest = await loadInstallManifest(projectDir);

    expect(manifest.entries).toHaveLength(2);
    expect(manifest.entries[0]).toEqual({
      kind: "skill",
      path: ".agents/skills/planning/SKILL.md",
      skill: "planning",
      targets: ["codex", "kimi"],
      hash: hashContent(formatSkillMarkdown(builtInSkillRegistry.get("planning"))),
    });
  });

  it("makes a reinstall a no-op instead of a conflict", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex"], projectDir, skills }));

    const manifest = await loadInstallManifest(projectDir);
    const plans = await planInstall({ targets: ["codex"], projectDir, skills, manifest });

    expect(plans[0]?.operations.map((operation) => operation.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
  });

  it("keeps entries for targets outside the run", async () => {
    await applyInstallPlans(
      await planInstall({ targets: ["codex", "claude"], projectDir, skills }),
    );

    const manifest = await loadInstallManifest(projectDir);
    await applyInstallPlans(
      await planInstall({ targets: ["codex"], projectDir, skills, manifest, prune: true }),
      { manifest },
    );

    const after = await loadInstallManifest(projectDir);

    expect(after.entries.map((entry) => entry.path)).toContain(".claude/skills/planning/SKILL.md");
  });

  it("removes a pruned skill file and its now-empty directory", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex"], projectDir, skills }));

    const manifest = await loadInstallManifest(projectDir);
    const plans = await planInstall({
      targets: ["codex"],
      projectDir,
      skills: [builtInSkillRegistry.get("planning")],
      manifest,
      prune: true,
    });
    const [result] = await applyInstallPlans(plans, { manifest });

    expect(result?.deleted).toEqual([".agents/skills/verification/SKILL.md"]);
    expect(await readdir(join(projectDir, ".agents", "skills"))).toEqual(["planning"]);
    expect((await loadInstallManifest(projectDir)).entries.map((entry) => entry.path)).toEqual([
      ".agents/skills/planning/SKILL.md",
    ]);
  });

  it("keeps a directory that still holds something else", async () => {
    await applyInstallPlans(await planInstall({ targets: ["codex"], projectDir, skills }));
    await writeFile(join(projectDir, ".agents", "skills", "verification", "NOTES.md"), "mine\n");

    const manifest = await loadInstallManifest(projectDir);
    const plans = await planInstall({
      targets: ["codex"],
      projectDir,
      skills: [builtInSkillRegistry.get("planning")],
      manifest,
      prune: true,
    });
    await applyInstallPlans(plans, { manifest });

    expect(await readdir(join(projectDir, ".agents", "skills", "verification"))).toEqual([
      "NOTES.md",
    ]);
  });

  it("leaves an uninstall with no trace of itself", async () => {
    await applyInstallPlans(
      await planInstall({
        targets: ["codex"],
        projectDir,
        skills,
        mcpServers: [builtInMcpServerRegistry.get("context7")],
      }),
    );

    const manifest = await loadInstallManifest(projectDir);
    const plans = await planUninstall({ targets: ["codex"], projectDir, manifest });
    await applyInstallPlans(plans, { manifest });

    expect(await readdir(projectDir)).toEqual([]);
  });
});
