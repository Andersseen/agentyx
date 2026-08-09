import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtInSkillRegistry, formatSkillMarkdown, parseSkillMarkdown } from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallPathError } from "../src/errors.js";
import { applyInstallPlan, applyInstallPlans } from "../src/executor.js";
import type { InstallOperation, InstallPlan } from "../src/plan.js";
import { planInstall, planTargetInstall } from "../src/planner.js";

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

  it("replaces drifted content deterministically", async () => {
    await applyInstallPlan(await planTargetInstall({ target: "codex", projectDir, skills }));

    const path = join(projectDir, ".agents", "skills", "planning", "SKILL.md");
    await writeFile(path, "---\nname: planning\ndescription: Edited\n---\n\nEdited.\n", "utf8");

    const plan = await planTargetInstall({ target: "codex", projectDir, skills });
    expect(plan.operations[0]?.status).toBe("update");

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
