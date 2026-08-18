import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalSkillDirectoryError } from "../src/config/errors.js";
import { loadAgentyxProject } from "../src/config/project.js";
import { resolveAgentyxConfig } from "../src/config/resolver.js";
import { UnknownTrustedSourceError } from "../src/source/errors.js";

describe("loadAgentyxProject", () => {
  let projectDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-project-"));
    outsideDir = await mkdtemp(join(tmpdir(), "agentyx-outside-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it("combines built-in and project-owned packs and Skills", async () => {
    const skillDir = join(projectDir, ".agentyx", "skills", "team-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: team-review\ndescription: Review changes using team conventions.\n---\n\nRead the team checklist.\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({
        packs: ["technical", "team"],
        targets: ["codex"],
        skillDirectories: [".agentyx/skills"],
        localPacks: [{ name: "team", category: "workflow", skills: ["team-review"] }],
      }),
      "utf8",
    );

    const project = await loadAgentyxProject(projectDir);
    const resolved = resolveAgentyxConfig(
      project.config,
      project.packRegistry,
      project.skillRegistry,
    );

    expect(resolved.skills).toEqual([
      "engineering-principles",
      "code-quality",
      "api-design",
      "code-review",
      "team-review",
    ]);
    expect(project.skillRegistry.get("team-review").content).toBe("Read the team checklist.");
  });

  it("rejects a Skill root symlinked outside the project", async () => {
    await mkdir(join(projectDir, ".agentyx"), { recursive: true });
    await symlink(outsideDir, join(projectDir, ".agentyx", "skills"));
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({ skillDirectories: [".agentyx/skills"] }),
      "utf8",
    );

    await expect(loadAgentyxProject(projectDir)).rejects.toThrow(LocalSkillDirectoryError);
    await expect(loadAgentyxProject(projectDir)).rejects.toThrow(/outside the project/);
  });

  it("requires the declared Skill name to match its directory", async () => {
    const skillDir = join(projectDir, ".agentyx", "skills", "team-review");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: another-name\ndescription: Review changes.\n---\n\nReview them.\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({ skillDirectories: [".agentyx/skills"] }),
      "utf8",
    );

    await expect(loadAgentyxProject(projectDir)).rejects.toThrow(
      'team-review/SKILL.md declares the name "another-name"',
    );
  });

  it("rejects unknown trusted source names", async () => {
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({
        trustedSources: [{ name: "not-superpowers", path: ".agentyx/sources/nope", ref: "v1" }],
      }),
      "utf8",
    );

    await expect(loadAgentyxProject(projectDir)).rejects.toThrow(UnknownTrustedSourceError);
  });
});
