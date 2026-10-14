import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareResolutionSnapshots,
  createAgentRegistry,
  createHookRegistry,
  createMcpServerRegistry,
  createPackRegistry,
  createResolutionSnapshot,
  createSkillRegistry,
  createToolRegistry,
  formatInstallManifest,
  loadAgentyxProject,
  parseAgentyxConfig,
  type ResolutionSnapshot,
  type ResolutionSnapshotInput,
  resolveAgentyxConfig,
} from "../src/index.js";

const projectDirs: string[] = [];

afterEach(async () => {
  await Promise.all(projectDirs.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function fixture(
  overrides: { selectedSkill?: string; envName?: string } = {},
): ResolutionSnapshotInput {
  const selectedSkill = overrides.selectedSkill ?? "Use the selected fixture skill.";
  const envName = overrides.envName ?? "FIXTURE_TOKEN";
  const packRegistry = createPackRegistry([
    {
      name: "fixture-pack",
      skills: ["selected-skill"],
      mcpServers: ["fixture-mcp"],
      tools: ["fixture-tool"],
      hooks: ["fixture-hook"],
      agents: [{ name: "fixture-agent" }],
    },
  ]);
  const skillRegistry = createSkillRegistry([
    {
      name: "selected-skill",
      load: () => ({
        name: "selected-skill",
        description: "Selected fixture skill.",
        content: selectedSkill,
      }),
    },
    {
      name: "unselected-skill",
      load: () => ({
        name: "unselected-skill",
        description: "Unselected fixture skill.",
        content: "This skill is not selected.",
      }),
    },
    {
      name: "agentyx-project-context",
      load: () => ({
        name: "agentyx-project-context",
        description: "Project context.",
        content: "Project context fixture.",
      }),
    },
  ]);
  const mcpRegistry = createMcpServerRegistry([
    {
      name: "fixture-mcp",
      load: () => ({
        name: "fixture-mcp",
        description: "Fixture MCP server.",
        transport: "stdio",
        command: "fixture-mcp",
        env: { TOKEN: { fromEnv: envName } },
      }),
    },
  ]);
  const toolRegistry = createToolRegistry([
    {
      name: "fixture-tool",
      load: () => ({
        name: "fixture-tool",
        description: "Fixture tool.",
        kind: "executable",
        command: "fixture-tool",
      }),
    },
  ]);
  const hookRegistry = createHookRegistry([
    {
      name: "fixture-hook",
      load: () => ({
        name: "fixture-hook",
        description: "Fixture hook.",
        event: "SessionStart",
        command: "fixture-hook",
        args: ["--provider", "{provider}"],
      }),
    },
  ]);
  const agentRegistry = createAgentRegistry([
    {
      name: "fixture-agent",
      load: () => ({
        name: "fixture-agent",
        description: "Fixture agent.",
        instructions: "Fixture instructions that must never appear in differences.",
        access: "read-only",
      }),
    },
  ]);
  const config = parseAgentyxConfig({
    packs: ["fixture-pack"],
    targets: ["codex", "claude"],
    context: { constraints: ["Keep this fixture deterministic."] },
  });
  const resolved = resolveAgentyxConfig(
    config,
    packRegistry,
    skillRegistry,
    mcpRegistry,
    toolRegistry,
    hookRegistry,
    agentRegistry,
  );

  return {
    agentyxVersion: "0.17.0",
    config,
    resolved,
    packRegistry,
    skillRegistry,
    mcpRegistry,
    toolRegistry,
    hookRegistry,
    agentRegistry,
  };
}

function snapshot(input = fixture()): ResolutionSnapshot {
  return createResolutionSnapshot(input);
}

describe("createResolutionSnapshot", () => {
  it("records the complete effective provider-neutral harness and provenance", () => {
    const result = snapshot();

    expect(result.agentyxVersion).toBe("0.17.0");
    expect(result.targets).toEqual(["claude", "codex"]);
    expect(result.skills.map(({ name }) => name)).toEqual([
      "selected-skill",
      "agentyx-project-context",
    ]);
    expect(result.mcpServers.map(({ name }) => name)).toEqual(["fixture-mcp"]);
    expect(result.tools.map(({ name }) => name)).toEqual(["fixture-tool"]);
    expect(result.hooks.map(({ name }) => name)).toEqual(["fixture-hook"]);
    expect(result.agents.map(({ name }) => name)).toEqual(["fixture-agent"]);
    expect(result.skills[0]?.origins).toEqual([{ kind: "pack", name: "fixture-pack" }]);
    expect(result.skills[1]?.origins).toEqual([{ kind: "project-context" }]);
    expect(result.agents[0]?.origins).toEqual([{ kind: "pack", name: "fixture-pack" }]);
    expect(result.configHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and formats a v2 manifest byte-for-byte identically", () => {
    const first = snapshot();
    const second = snapshot();
    const firstManifest = formatInstallManifest({ version: 2, entries: [], resolution: first });
    const secondManifest = formatInstallManifest({ version: 2, entries: [], resolution: second });

    expect(second).toEqual(first);
    expect(secondManifest).toBe(firstManifest);
  });

  it("sorts set-like targets but retains resolution order for capabilities", () => {
    const input = fixture();
    const reversed = {
      ...input,
      config: parseAgentyxConfig({ packs: ["fixture-pack"], targets: ["claude", "codex"] }),
      resolved: { ...input.resolved, targets: ["codex", "claude", "codex"] },
    };

    expect(createResolutionSnapshot(reversed).targets).toEqual(["claude", "codex"]);
    expect(createResolutionSnapshot(reversed).skills.map(({ name }) => name)).toEqual(
      input.resolved.skills,
    );
  });

  it("excludes $schema and canonicalizes object key order", () => {
    const base = fixture();
    const one = createResolutionSnapshot({
      ...base,
      config: parseAgentyxConfig({
        $schema: "./schema-a.json",
        packs: ["fixture-pack"],
        targets: ["codex", "claude"],
        context: { constraints: ["Keep this fixture deterministic."] },
      }),
    });
    const two = createResolutionSnapshot({
      ...base,
      config: parseAgentyxConfig({
        context: { constraints: ["Keep this fixture deterministic."] },
        targets: ["claude", "codex"],
        packs: ["fixture-pack"],
        $schema: "https://example.test/schema.json",
      }),
    });

    expect(two.configHash).toBe(one.configHash);
  });

  it("changes selected local Skill content but ignores unselected Skill content", () => {
    const original = snapshot();
    const selectedChanged = snapshot(fixture({ selectedSkill: "A changed selected skill." }));
    const unselectedChanged = snapshot();

    expect(selectedChanged.skills.find(({ name }) => name === "selected-skill")?.hash).not.toBe(
      original.skills.find(({ name }) => name === "selected-skill")?.hash,
    );
    expect(unselectedChanged).toEqual(original);
  });

  it("keeps MCP snapshots invariant to environment values while hashing references", () => {
    const previous = process.env.SUPABASE_ACCESS_TOKEN;

    try {
      process.env.SUPABASE_ACCESS_TOKEN = "first-secret";
      const first = snapshot(fixture({ envName: "SUPABASE_ACCESS_TOKEN" }));
      process.env.SUPABASE_ACCESS_TOKEN = "second-secret";
      const second = snapshot(fixture({ envName: "SUPABASE_ACCESS_TOKEN" }));
      const renamed = snapshot(fixture({ envName: "OTHER_TOKEN" }));

      expect(second).toEqual(first);
      expect(renamed.mcpServers[0]?.hash).not.toBe(first.mcpServers[0]?.hash);
      expect(JSON.stringify(second)).not.toContain("secret");
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_ACCESS_TOKEN;
      else process.env.SUPABASE_ACCESS_TOKEN = previous;
    }
  });

  it("represents typed exclusions in configHash and effective selection", () => {
    const base = fixture();
    const excludedConfig = parseAgentyxConfig({
      packs: ["fixture-pack"],
      targets: ["codex", "claude"],
      exclude: { skills: ["selected-skill"] },
    });
    const excluded = createResolutionSnapshot({
      ...base,
      config: excludedConfig,
      resolved: resolveAgentyxConfig(
        excludedConfig,
        base.packRegistry,
        base.skillRegistry,
        base.mcpRegistry,
        base.toolRegistry,
        base.hookRegistry,
        base.agentRegistry,
      ),
    });

    expect(excluded.configHash).not.toBe(snapshot(base).configHash);
    expect(excluded.skills.map(({ name }) => name)).not.toContain("selected-skill");
  });

  it("changes configHash when an already-disabled optional capability is excluded", () => {
    const base = fixture();
    const config = parseAgentyxConfig({
      packs: ["optional-pack"],
      targets: ["codex", "claude"],
    });
    const excluded = parseAgentyxConfig({
      ...config,
      exclude: { mcpServers: ["fixture-mcp"] },
    });
    const packRegistry = createPackRegistry([
      {
        name: "optional-pack",
        mcpServers: [{ name: "fixture-mcp", activation: "optional" }],
      },
    ]);
    const baseResolved = resolveAgentyxConfig(
      config,
      packRegistry,
      base.skillRegistry,
      base.mcpRegistry,
      base.toolRegistry,
      base.hookRegistry,
      base.agentRegistry,
    );
    const excludedResolved = resolveAgentyxConfig(
      excluded,
      packRegistry,
      base.skillRegistry,
      base.mcpRegistry,
      base.toolRegistry,
      base.hookRegistry,
      base.agentRegistry,
    );
    const baseSnapshot = createResolutionSnapshot({
      ...base,
      config,
      resolved: baseResolved,
      packRegistry,
    });
    const excludedSnapshot = createResolutionSnapshot({
      ...base,
      config: excluded,
      resolved: excludedResolved,
      packRegistry,
    });

    expect(baseResolved.mcpServers).toEqual(excludedResolved.mcpServers);
    expect(excludedSnapshot.configHash).not.toBe(baseSnapshot.configHash);
    expect(excludedSnapshot.mcpServers).toEqual(baseSnapshot.mcpServers);
  });

  it("changes the generated project-context Skill when project facts change", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentyx-snapshot-context-"));
    projectDirs.push(directory);
    await writeFile(
      join(directory, ".agentyx.json"),
      JSON.stringify({ packs: [], targets: ["codex"], project: { id: "web", name: "Web" } }),
    );
    const firstProject = await loadAgentyxProject(directory);
    const firstConfig = resolveAgentyxConfig(
      firstProject.config,
      firstProject.packRegistry,
      firstProject.skillRegistry,
    );
    const first = createResolutionSnapshot({
      ...fixture(),
      config: firstProject.config,
      resolved: firstConfig,
      packRegistry: firstProject.packRegistry,
      skillRegistry: firstProject.skillRegistry,
    });
    await writeFile(
      join(directory, ".agentyx.json"),
      JSON.stringify({ packs: [], targets: ["codex"], project: { id: "web", name: "Changed" } }),
    );
    const secondProject = await loadAgentyxProject(directory);
    const secondConfig = resolveAgentyxConfig(
      secondProject.config,
      secondProject.packRegistry,
      secondProject.skillRegistry,
    );
    const second = createResolutionSnapshot({
      ...fixture(),
      config: secondProject.config,
      resolved: secondConfig,
      packRegistry: secondProject.packRegistry,
      skillRegistry: secondProject.skillRegistry,
    });

    expect(second.configHash).not.toBe(first.configHash);
    expect(second.skills.find(({ name }) => name === "agentyx-project-context")?.hash).not.toBe(
      first.skills.find(({ name }) => name === "agentyx-project-context")?.hash,
    );
  });
});

describe("compareResolutionSnapshots", () => {
  it("returns no differences for identical snapshots", () => {
    expect(compareResolutionSnapshots(snapshot(), snapshot())).toEqual([]);
  });

  it("reports version, config and target differences", () => {
    const expected = snapshot();
    const actual = {
      ...expected,
      agentyxVersion: "0.18.0",
      configHash: "a".repeat(64),
      targets: ["claude", "new-target"],
    } as ResolutionSnapshot;

    expect(compareResolutionSnapshots(expected, actual)).toEqual([
      { kind: "agentyx-version", change: "changed" },
      { kind: "config", change: "changed" },
      { kind: "targets", name: "codex", change: "removed" },
      { kind: "targets", name: "new-target", change: "added" },
    ]);
  });

  it("reports every modern capability difference without exposing definitions", () => {
    const expected = snapshot();
    const actual = {
      ...expected,
      skills: expected.skills.map((entry) =>
        entry.name === "selected-skill" ? { ...entry, hash: "b".repeat(64) } : entry,
      ),
      mcpServers: [],
      tools: expected.tools.map((entry) => ({ ...entry, hash: "c".repeat(64) })),
      hooks: [
        ...expected.hooks.map((entry) => ({ ...entry, hash: "d".repeat(64) })),
        { name: "new-hook", hash: "f".repeat(64), origins: entryOrigin() },
      ],
      agents: expected.agents.map((entry) => ({ ...entry, hash: "e".repeat(64) })),
    } satisfies ResolutionSnapshot;

    const differences = compareResolutionSnapshots(expected, actual);

    expect(differences).toEqual([
      { kind: "skill", name: "selected-skill", change: "changed" },
      { kind: "mcp", name: "fixture-mcp", change: "removed" },
      { kind: "tool", name: "fixture-tool", change: "changed" },
      { kind: "hook", name: "fixture-hook", change: "changed" },
      { kind: "hook", name: "new-hook", change: "added" },
      { kind: "agent", name: "fixture-agent", change: "changed" },
    ]);
    expect(JSON.stringify(differences)).not.toContain("instructions");
  });
});

describe("resolution snapshots across checkout paths", () => {
  it("do not contain absolute project paths", async () => {
    const firstDir = await createLocalProject("first");
    const secondDir = await createLocalProject("second");
    const first = await localProjectSnapshot(firstDir);
    const second = await localProjectSnapshot(secondDir);

    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toContain(firstDir);
    expect(JSON.stringify(first)).not.toContain(secondDir);
  });
});

function entryOrigin(): [{ kind: "pack"; name: string }] {
  return [{ kind: "pack", name: "fixture-pack" }];
}

async function createLocalProject(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `agentyx-snapshot-${label}-`));
  projectDirs.push(directory);
  await mkdir(join(directory, "skills", "local-skill"), { recursive: true });
  await writeFile(
    join(directory, ".agentyx.json"),
    JSON.stringify({
      packs: ["local-pack"],
      targets: ["codex"],
      skillDirectories: ["skills"],
      localPacks: [{ name: "local-pack", skills: ["local-skill"] }],
    }),
  );
  await writeFile(
    join(directory, "skills", "local-skill", "SKILL.md"),
    "---\nname: local-skill\ndescription: Local skill.\n---\n\nUse the local skill.\n",
  );
  return directory;
}

async function localProjectSnapshot(directory: string): Promise<ResolutionSnapshot> {
  const project = await loadAgentyxProject(directory);
  const resolved = resolveAgentyxConfig(
    project.config,
    project.packRegistry,
    project.skillRegistry,
  );
  const base = fixture();

  return createResolutionSnapshot({
    ...base,
    config: project.config,
    resolved,
    packRegistry: project.packRegistry,
    skillRegistry: project.skillRegistry,
  });
}
