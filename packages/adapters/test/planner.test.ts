import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  formatSkillMarkdown,
  hashContent,
  INSTALL_MANIFEST_VERSION,
  type InstallManifest,
  type InstallManifestEntry,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentAdapter } from "../src/adapter.js";
import {
  InstallPathError,
  MissingInstallTargetsError,
  SharedInstallConflictError,
  UnknownAdapterError,
} from "../src/errors.js";
import { planInstall, planTargetInstall, planUninstall } from "../src/planner.js";
import { createAdapterRegistry } from "../src/registry.js";

const skills = ["planning", "verification"].map((name) => builtInSkillRegistry.get(name));

describe("planTargetInstall", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-planner-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("plans a write per skill, all inside the target's directory", async () => {
    const plan = await planTargetInstall({ target: "codex", projectDir, skills });

    expect(plan.target).toBe("codex");
    expect(plan.name).toBe("Codex");
    expect(plan.relativeSkillsPath).toBe(".agents/skills");
    expect(plan.operations.map((operation) => operation.relativePath)).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);
    expect(plan.operations.every((operation) => operation.type === "write-file")).toBe(true);
    expect(plan.operations.every((operation) => operation.path.startsWith(plan.skillsPath))).toBe(
      true,
    );
  });

  it("writes nothing while planning", async () => {
    await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });
    await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });

    expect(await readdir(projectDir)).toEqual([]);
  });

  it("plans MCP configuration beside skill files", async () => {
    const plan = await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });

    expect(plan.operations).toHaveLength(2);
    expect(plan.mcpOperations).toMatchObject([
      {
        type: "configure-mcp",
        status: "create",
        relativePath: ".mcp.json",
        servers: ["context7"],
      },
    ]);
  });

  it("represents unsupported project MCP scope without failing skill planning", async () => {
    const registry = createAdapterRegistry([
      {
        id: "acme",
        name: "Acme",
        capabilities: { skills: true, mcp: { project: false, global: false } },
        skillsPath: (dir) => join(dir, ".acme"),
        detect: async (dir) => ({
          target: "acme",
          skillsPath: join(dir, ".acme"),
          present: false,
          configured: false,
        }),
        planFiles: ({ skills: resolved }) =>
          resolved.map((skill) => ({
            segments: [".acme", `${skill.name}.md`],
            content: formatSkillMarkdown(skill),
            skill: skill.name,
          })),
      },
    ]);

    const plan = await planTargetInstall({
      target: "acme",
      projectDir,
      skills,
      mcpServers: [builtInMcpServerRegistry.get("context7")],
      registry,
    });

    expect(plan.operations).toHaveLength(2);
    expect(plan.mcpOperations).toEqual([]);
    expect(plan.unsupportedMcp).toEqual(["context7"]);
  });

  it("preserves unrelated provider MCP configuration on real writes", async () => {
    await mkdir(join(projectDir, ".codex"), { recursive: true });
    await writeFile(
      join(projectDir, ".codex", "config.toml"),
      'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "other"\nargs = []\nenabled = true\n',
    );
    await writeFile(
      join(projectDir, ".mcp.json"),
      JSON.stringify({
        custom: true,
        mcpServers: { other: { type: "stdio", command: "other", args: [] } },
      }),
    );

    const plans = await planInstall({
      targets: ["codex", "claude"],
      projectDir,
      skills: [],
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });

    expect(plans[0]?.mcpOperations[0]?.content).toContain('model = "gpt-5"');
    expect(plans[0]?.mcpOperations[0]?.content).toContain("[mcp_servers.other]");
    expect(JSON.parse(plans[1]?.mcpOperations[0]?.content ?? "{}")).toMatchObject({
      custom: true,
      mcpServers: {
        other: { type: "stdio", command: "other", args: [] },
        context7: { type: "http", url: "https://mcp.context7.com/mcp" },
      },
    });
  });

  it("marks an existing MCP config as unchanged when reinstalling", async () => {
    const first = await planTargetInstall({
      target: "codex",
      projectDir,
      skills: [],
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });
    await mkdir(join(projectDir, ".codex"), { recursive: true });
    await writeFile(
      join(projectDir, ".codex", "config.toml"),
      first.mcpOperations[0]?.content ?? "",
    );

    const second = await planTargetInstall({
      target: "codex",
      projectDir,
      skills: [],
      mcpServers: [builtInMcpServerRegistry.get("context7")],
    });

    expect(second.mcpOperations[0]?.status).toBe("unchanged");
  });

  it("marks a missing file as create", async () => {
    const plan = await planTargetInstall({ target: "claude", projectDir, skills });

    expect(plan.operations.map((operation) => operation.status)).toEqual(["create", "create"]);
  });

  it("marks identical content as unchanged", async () => {
    const path = join(projectDir, ".claude", "skills", "planning");
    await mkdir(path, { recursive: true });
    await writeFile(
      join(path, "SKILL.md"),
      formatSkillMarkdown(builtInSkillRegistry.get("planning")),
      "utf8",
    );

    const plan = await planTargetInstall({ target: "claude", projectDir, skills });

    expect(plan.operations.map((operation) => operation.status)).toEqual(["unchanged", "create"]);
  });

  it("refuses to claim content it has no record of writing", async () => {
    const path = join(projectDir, ".claude", "skills", "planning");
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), "---\nname: planning\ndescription: Old\n---\n\nOld.\n");

    const plan = await planTargetInstall({ target: "claude", projectDir, skills });

    expect(plan.operations[0]?.status).toBe("conflict");
    expect(plan.operations[0]?.content).toBe(
      formatSkillMarkdown(builtInSkillRegistry.get("planning")),
    );
  });

  it("replaces its own content when the manifest vouches for it", async () => {
    const path = join(projectDir, ".claude", "skills", "planning");
    const stale = "---\nname: planning\ndescription: Old\n---\n\nOld.\n";
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), stale);

    const plan = await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      manifest: {
        version: INSTALL_MANIFEST_VERSION,
        entries: [
          {
            kind: "skill",
            path: ".claude/skills/planning/SKILL.md",
            skill: "planning",
            targets: ["claude"],
            hash: hashContent(stale),
          },
        ],
      },
    });

    expect(plan.operations[0]?.status).toBe("update");
  });

  it("overwrites a conflict only when forced", async () => {
    const path = join(projectDir, ".claude", "skills", "planning");
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), "hand-written\n");

    const plan = await planTargetInstall({ target: "claude", projectDir, skills, force: true });

    expect(plan.operations[0]?.status).toBe("update");
  });

  it("ignores files it does not manage", async () => {
    await mkdir(join(projectDir, ".claude", "skills", "somebody-elses"), { recursive: true });
    await writeFile(
      join(projectDir, ".claude", "skills", "somebody-elses", "SKILL.md"),
      "not ours",
      "utf8",
    );

    const plan = await planTargetInstall({ target: "claude", projectDir, skills });

    expect(plan.operations.map((operation) => operation.skill)).toEqual([
      "planning",
      "verification",
    ]);
  });

  it("fails on an unknown target", async () => {
    await expect(planTargetInstall({ target: "opencode", projectDir, skills })).rejects.toThrow(
      UnknownAdapterError,
    );
  });

  it("accepts a custom registry", async () => {
    const registry = createAdapterRegistry([
      {
        id: "acme",
        name: "Acme",
        capabilities: { skills: true, mcp: { project: false, global: false } },
        skillsPath: (dir) => join(dir, ".acme"),
        detect: async (dir) => ({
          target: "acme",
          skillsPath: join(dir, ".acme"),
          present: false,
          configured: false,
        }),
        planFiles: ({ skills: resolved }) =>
          resolved.map((skill) => ({
            segments: [".acme", `${skill.name}.md`],
            content: formatSkillMarkdown(skill),
            skill: skill.name,
          })),
      },
    ]);

    const plan = await planTargetInstall({ target: "acme", projectDir, skills, registry });

    expect(plan.operations.map((operation) => operation.relativePath)).toEqual([
      ".acme/planning.md",
      ".acme/verification.md",
    ]);
  });
});

describe("planTargetInstall containment", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-planner-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  const withAdapter = (adapter: AgentAdapter) =>
    planTargetInstall({
      target: adapter.id,
      projectDir,
      skills,
      registry: createAdapterRegistry([adapter]),
    });

  const escaping = (segments: readonly string[]): AgentAdapter => ({
    id: "escaping",
    name: "Escaping",
    capabilities: { skills: true, mcp: { project: false, global: false } },
    skillsPath: (dir) => join(dir, ".escaping"),
    detect: async (dir) => ({
      target: "escaping",
      skillsPath: join(dir, ".escaping"),
      present: false,
      configured: false,
    }),
    planFiles: ({ skills: resolved }) =>
      resolved.map((skill) => ({ segments, content: "x", skill: skill.name })),
  });

  it("rejects a file that climbs out of the target directory", async () => {
    await expect(withAdapter(escaping([".escaping", "..", "..", "escaped.md"]))).rejects.toThrow(
      InstallPathError,
    );
  });

  it("rejects a file elsewhere in the project", async () => {
    await expect(withAdapter(escaping(["package.json"]))).rejects.toThrow(InstallPathError);
  });

  it("rejects an absolute destination", async () => {
    await expect(withAdapter(escaping([join(tmpdir(), "agentyx-escaped.md")]))).rejects.toThrow(
      InstallPathError,
    );
  });

  it("rejects an adapter whose directory is outside the project", async () => {
    await expect(
      withAdapter({
        id: "escaping",
        name: "Escaping",
        capabilities: { skills: true, mcp: { project: false, global: false } },
        skillsPath: () => tmpdir(),
        detect: async () => ({
          target: "escaping",
          skillsPath: tmpdir(),
          present: false,
          configured: false,
        }),
        planFiles: () => [],
      }),
    ).rejects.toThrow(InstallPathError);
  });

  it("rejects an adapter that claims the project root", async () => {
    await expect(
      withAdapter({
        id: "escaping",
        name: "Escaping",
        capabilities: { skills: true, mcp: { project: false, global: false } },
        skillsPath: (dir) => dir,
        detect: async (dir) => ({
          target: "escaping",
          skillsPath: dir,
          present: false,
          configured: false,
        }),
        planFiles: () => [],
      }),
    ).rejects.toThrow(InstallPathError);
  });

  it("rejects a target directory redirected by a symlink", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "agentyx-outside-"));

    try {
      await symlink(outsideDir, join(projectDir, ".agents"));

      await expect(
        withAdapter(escaping([".agents", "skills", "planning", "SKILL.md"])),
      ).rejects.toThrow(InstallPathError);
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});

describe("planInstall", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-planner-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("returns one plan per target, in the requested order", async () => {
    const plans = await planInstall({ targets: ["claude", "codex", "kimi"], projectDir, skills });

    expect(plans.map((plan) => plan.target)).toEqual(["claude", "codex", "kimi"]);
  });

  it("installs the same skill content into every provider", async () => {
    const [codex, claude, kimi] = await planInstall({
      targets: ["codex", "claude", "kimi"],
      projectDir,
      skills,
    });

    expect(codex?.operations.map((operation) => operation.content)).toEqual(
      claude?.operations.map((operation) => operation.content),
    );
    expect(kimi?.operations.map((operation) => operation.content)).toEqual(
      codex?.operations.map((operation) => operation.content),
    );
    expect(codex?.operations.map((operation) => operation.relativePath)).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);
    expect(claude?.operations.map((operation) => operation.relativePath)).toEqual([
      ".claude/skills/planning/SKILL.md",
      ".claude/skills/verification/SKILL.md",
    ]);
    expect(kimi?.operations.map((operation) => operation.relativePath)).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);
    expect(kimi?.operations.map((operation) => operation.usedBy)).toEqual([
      ["codex", "kimi"],
      ["codex", "kimi"],
    ]);
  });

  it("hands every adapter the very same skill objects", async () => {
    const skill = builtInSkillRegistry.get("angular-modern");
    const plans = await planInstall({
      targets: ["codex", "claude", "kimi"],
      projectDir,
      skills: [skill],
    });
    const contents = new Set(
      plans.flatMap((plan) => plan.operations.map((operation) => operation.content)),
    );

    expect(builtInSkillRegistry.get("angular-modern")).toBe(skill);
    expect(contents.size).toBe(1);
  });

  it("collapses a repeated target", async () => {
    const plans = await planInstall({ targets: ["codex", "codex"], projectDir, skills });

    expect(plans.map((plan) => plan.target)).toEqual(["codex"]);
  });

  it("fails when no target is supplied", async () => {
    await expect(planInstall({ targets: [], projectDir, skills })).rejects.toThrow(
      MissingInstallTargetsError,
    );
  });

  it("writes nothing", async () => {
    await planInstall({ targets: ["codex", "claude", "kimi"], projectDir, skills });

    expect(await readdir(projectDir)).toEqual([]);
  });

  it("keeps one effective operation for providers sharing the same destination and content", async () => {
    const plans = await planInstall({ targets: ["codex", "kimi"], projectDir, skills });

    expect(
      plans.flatMap((plan) => plan.operations.map((operation) => operation.relativePath)),
    ).toEqual([
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
      ".agents/skills/planning/SKILL.md",
      ".agents/skills/verification/SKILL.md",
    ]);
    expect(plans[0]?.operations[0]?.usedBy).toEqual(["codex", "kimi"]);
    expect(plans[1]?.operations[0]?.usedBy).toEqual(["codex", "kimi"]);
  });

  it("hands one MCP definition set to Codex, Claude and Kimi", async () => {
    const plans = await planInstall({
      targets: ["codex", "claude", "kimi"],
      projectDir,
      skills: [],
      mcpServers: [
        builtInMcpServerRegistry.get("context7"),
        builtInMcpServerRegistry.get("playwright"),
      ],
    });

    expect(plans.map((plan) => plan.target)).toEqual(["codex", "claude", "kimi"]);
    expect(plans.map((plan) => plan.mcpOperations[0]?.relativePath)).toEqual([
      ".codex/config.toml",
      ".mcp.json",
      ".kimi-code/mcp.json",
    ]);
    expect(plans.map((plan) => plan.mcpOperations[0]?.servers)).toEqual([
      ["context7", "playwright"],
      ["context7", "playwright"],
      ["context7", "playwright"],
    ]);
  });

  it("rejects shared destinations with different content", async () => {
    const shared = (id: string, content: string): AgentAdapter => ({
      id,
      name: id,
      capabilities: { skills: true, mcp: { project: false, global: false } },
      skillsPath: (dir) => join(dir, ".agents", "skills"),
      detect: async (dir) => ({
        target: id,
        skillsPath: join(dir, ".agents", "skills"),
        present: false,
        configured: false,
      }),
      planFiles: ({ skills: resolved }) =>
        resolved.map((skill) => ({
          segments: [".agents", "skills", skill.name, "SKILL.md"],
          content,
          skill: skill.name,
        })),
    });

    await expect(
      planInstall({
        targets: ["left", "right"],
        projectDir,
        skills: [builtInSkillRegistry.get("planning")],
        registry: createAdapterRegistry([shared("left", "left"), shared("right", "right")]),
      }),
    ).rejects.toThrow(SharedInstallConflictError);
  });
});

describe("pruning", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-prune-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  async function installed(
    path: string,
    content: string,
    targets: readonly string[],
    skill: string,
  ): Promise<void> {
    await mkdir(join(projectDir, ...path.split("/").slice(0, -1)), { recursive: true });
    await writeFile(join(projectDir, ...path.split("/")), content, "utf8");
    manifestEntries.push({
      kind: "skill",
      path,
      skill,
      targets: [...targets],
      hash: hashContent(content),
    });
  }

  let manifestEntries: InstallManifestEntry[] = [];

  beforeEach(() => {
    manifestEntries = [];
  });

  function manifest(): InstallManifest {
    return { version: INSTALL_MANIFEST_VERSION, entries: manifestEntries };
  }

  it("proposes no removals unless pruning is asked for", async () => {
    await installed(".agents/skills/dropped/SKILL.md", "old\n", ["codex"], "dropped");

    const plan = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest: manifest(),
    });

    expect(plan.deletions).toEqual([]);
  });

  it("removes a managed skill nothing resolves any more", async () => {
    await installed(".agents/skills/dropped/SKILL.md", "old\n", ["codex"], "dropped");

    const plan = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest: manifest(),
      prune: true,
    });

    expect(plan.deletions).toEqual([
      {
        type: "delete-file",
        status: "delete",
        kind: "skill",
        path: join(projectDir, ".agents", "skills", "dropped", "SKILL.md"),
        relativePath: ".agents/skills/dropped/SKILL.md",
        skill: "dropped",
        usedBy: ["codex"],
      },
    ]);
  });

  it("leaves a managed skill that was edited since Agentyx wrote it", async () => {
    await installed(".agents/skills/dropped/SKILL.md", "old\n", ["codex"], "dropped");
    await writeFile(
      join(projectDir, ".agents", "skills", "dropped", "SKILL.md"),
      "mine now\n",
      "utf8",
    );

    const plan = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest: manifest(),
      prune: true,
    });

    expect(plan.deletions[0]?.status).toBe("conflict");
  });

  it("never removes a file another provider in the project still shares", async () => {
    await installed(".agents/skills/dropped/SKILL.md", "old\n", ["codex", "kimi"], "dropped");

    const alone = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest: manifest(),
      prune: true,
    });

    expect(alone.deletions).toEqual([]);

    const together = await planInstall({
      targets: ["codex", "kimi"],
      projectDir,
      skills,
      manifest: manifest(),
      prune: true,
    });

    expect(together[0]?.deletions[0]?.status).toBe("delete");
  });

  it("never touches a path recorded for a different provider", async () => {
    await installed(".claude/skills/dropped/SKILL.md", "old\n", ["claude"], "dropped");

    const plan = await planTargetInstall({
      target: "codex",
      projectDir,
      skills,
      manifest: manifest(),
      prune: true,
    });

    expect(plan.deletions).toEqual([]);
  });

  it("takes back only the MCP keys it added", async () => {
    await writeFile(
      join(projectDir, ".mcp.json"),
      `${JSON.stringify({ mcpServers: { mine: { type: "stdio", command: "mine", args: [] }, context7: { type: "http", url: "https://mcp.context7.com/mcp" } } }, null, 2)}\n`,
      "utf8",
    );

    const plan = await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      mcpServers: [],
      prune: true,
      manifest: {
        version: INSTALL_MANIFEST_VERSION,
        entries: [
          {
            kind: "mcp",
            path: ".mcp.json",
            servers: ["context7"],
            targets: ["claude"],
            hash: hashContent("irrelevant"),
            created: false,
          },
        ],
      },
    });

    const parsed = JSON.parse(plan.mcpOperations[0]?.content ?? "{}");

    expect(parsed.mcpServers.context7).toBeUndefined();
    expect(parsed.mcpServers.mine).toEqual({ type: "stdio", command: "mine", args: [] });
    expect(plan.deletions).toEqual([]);
  });

  it("removes an MCP config it created once nothing is left in it", async () => {
    const content = `${JSON.stringify({ mcpServers: { context7: { type: "http", url: "https://mcp.context7.com/mcp" } } }, null, 2)}\n`;
    await writeFile(join(projectDir, ".mcp.json"), content, "utf8");

    const plan = await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      mcpServers: [],
      prune: true,
      manifest: {
        version: INSTALL_MANIFEST_VERSION,
        entries: [
          {
            kind: "mcp",
            path: ".mcp.json",
            servers: ["context7"],
            targets: ["claude"],
            hash: hashContent(content),
            created: true,
          },
        ],
      },
    });

    expect(plan.mcpOperations).toEqual([]);
    expect(plan.deletions[0]).toMatchObject({
      kind: "mcp",
      status: "delete",
      relativePath: ".mcp.json",
    });
  });

  it("keeps an MCP config the user already had, even when emptied", async () => {
    const content = `${JSON.stringify({ mcpServers: { context7: { type: "http", url: "https://mcp.context7.com/mcp" } } }, null, 2)}\n`;
    await writeFile(join(projectDir, ".mcp.json"), content, "utf8");

    const plan = await planTargetInstall({
      target: "claude",
      projectDir,
      skills,
      mcpServers: [],
      prune: true,
      manifest: {
        version: INSTALL_MANIFEST_VERSION,
        entries: [
          {
            kind: "mcp",
            path: ".mcp.json",
            servers: ["context7"],
            targets: ["claude"],
            hash: hashContent(content),
            created: false,
          },
        ],
      },
    });

    expect(plan.deletions).toEqual([]);
    expect(plan.mcpOperations[0]?.content).toBe("{}\n");
  });
});

describe("planUninstall", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-uninstall-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("plans the removal of everything recorded, and writes nothing", async () => {
    const content = formatSkillMarkdown(builtInSkillRegistry.get("planning"));
    await mkdir(join(projectDir, ".agents", "skills", "planning"), { recursive: true });
    await writeFile(join(projectDir, ".agents", "skills", "planning", "SKILL.md"), content, "utf8");

    const plans = await planUninstall({
      targets: ["codex"],
      projectDir,
      manifest: {
        version: INSTALL_MANIFEST_VERSION,
        entries: [
          {
            kind: "skill",
            path: ".agents/skills/planning/SKILL.md",
            skill: "planning",
            targets: ["codex"],
            hash: hashContent(content),
          },
        ],
      },
    });

    expect(plans[0]?.operations).toEqual([]);
    expect(plans[0]?.deletions.map((operation) => operation.relativePath)).toEqual([
      ".agents/skills/planning/SKILL.md",
    ]);
    expect(
      await readFile(join(projectDir, ".agents", "skills", "planning", "SKILL.md"), "utf8"),
    ).toBe(content);
  });
});
