import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtInSkillRegistry, formatSkillMarkdown } from "@agnox/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { builtInAdapterRegistry } from "../src/built-in.js";
import { createSkillDirectoryAdapter } from "../src/skill-directory.js";

const codex = builtInAdapterRegistry.get("codex");
const claude = builtInAdapterRegistry.get("claude");
const skills = ["planning", "verification", "angular-modern"].map((name) =>
  builtInSkillRegistry.get(name),
);
/** Never created on disk: `skillsPath` and `planFiles` must not touch a filesystem. */
const projectDir = join(tmpdir(), "agnox-project");

describe("skill destinations", () => {
  /**
   * Both destinations are the providers' documented project-local conventions.
   * Codex reads repository skills from `.agents/skills`, the vendor-neutral
   * location, which is why there is no `.codex` directory here.
   */
  it("installs Codex skills into .agents/skills", () => {
    expect(codex.skillsPath(projectDir)).toBe(join(projectDir, ".agents", "skills"));
  });

  it("installs Claude Code skills into .claude/skills", () => {
    expect(claude.skillsPath(projectDir)).toBe(join(projectDir, ".claude", "skills"));
  });

  it("stays inside the project — nothing is installed globally", () => {
    for (const adapter of builtInAdapterRegistry.list()) {
      expect(adapter.skillsPath(projectDir).startsWith(projectDir)).toBe(true);
    }
  });
});

describe("planFiles", () => {
  it("plans one SKILL.md per requested skill, in order", () => {
    const files = codex.planFiles({ projectDir, skills });

    expect(files.map((file) => file.skill)).toEqual(["planning", "verification", "angular-modern"]);
    expect(files.map((file) => file.segments)).toEqual([
      [".agents", "skills", "planning", "SKILL.md"],
      [".agents", "skills", "verification", "SKILL.md"],
      [".agents", "skills", "angular-modern", "SKILL.md"],
    ]);
  });

  it("uses the Claude Code directory for the same skills", () => {
    expect(claude.planFiles({ projectDir, skills }).map((f) => f.segments)).toEqual([
      [".claude", "skills", "planning", "SKILL.md"],
      [".claude", "skills", "verification", "SKILL.md"],
      [".claude", "skills", "angular-modern", "SKILL.md"],
    ]);
  });

  it("writes the canonical serialization, not a provider-specific one", () => {
    const [file] = codex.planFiles({ projectDir, skills });

    expect(file?.content).toBe(formatSkillMarkdown(builtInSkillRegistry.get("planning")));
  });

  it("gives both providers byte-identical content from the same skill object", () => {
    const skill = builtInSkillRegistry.get("angular-modern");
    const context = { projectDir, skills: [skill] };

    const [forCodex] = codex.planFiles(context);
    const [forClaude] = claude.planFiles(context);

    expect(forCodex?.content).toBe(forClaude?.content);
    expect(forCodex?.segments).not.toEqual(forClaude?.segments);
  });

  it("plans nothing when no skill resolves", () => {
    expect(codex.planFiles({ projectDir, skills: [] })).toEqual([]);
  });
});

describe("detect", () => {
  let temporaryProject: string;

  beforeEach(async () => {
    temporaryProject = await mkdtemp(join(tmpdir(), "agnox-adapter-"));
  });

  afterEach(async () => {
    await rm(temporaryProject, { recursive: true, force: true });
  });

  it("reports an absent directory without creating it", async () => {
    const detection = await codex.detect(temporaryProject);

    expect(detection).toEqual({
      target: "codex",
      skillsPath: join(temporaryProject, ".agents", "skills"),
      present: false,
    });
    expect(await readdir(temporaryProject)).toEqual([]);
  });

  it("reports a directory that exists", async () => {
    await mkdir(join(temporaryProject, ".claude", "skills"), { recursive: true });

    expect((await claude.detect(temporaryProject)).present).toBe(true);
  });
});

describe("createSkillDirectoryAdapter", () => {
  it("builds a third-party adapter from a directory alone", () => {
    const adapter = createSkillDirectoryAdapter({
      id: "acme",
      name: "Acme Agent",
      skillsDir: [".acme", "skills"],
      reference: "https://example.invalid/skills",
    });

    expect(adapter.planFiles({ projectDir, skills })[0]?.segments).toEqual([
      ".acme",
      "skills",
      "planning",
      "SKILL.md",
    ]);
    expect(adapter.planFiles({ projectDir, skills })[0]?.content).toBe(
      formatSkillMarkdown(builtInSkillRegistry.get("planning")),
    );
  });
});
