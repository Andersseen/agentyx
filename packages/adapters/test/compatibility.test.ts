/**
 * Provider compatibility contract (R100-01).
 *
 * These tests pin what Agentyx writes for each provider against the formats documented in
 * docs/compatibility.md. They check configuration rendering and lifecycle safety only: none of
 * them proves that a provider loaded or used the result, and none touches the network or $HOME.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type AgentDefinition,
  builtInAgentNames,
  builtInAgentRegistry,
  builtInHookRegistry,
  builtInMcpServerRegistry,
  builtInSkillNames,
  builtInSkillRegistry,
  emptyInstallManifest,
  formatSkillMarkdown,
  loadInstallManifest,
  mcpServerDefinitionSchema,
  parseInstallManifest,
} from "@agentyx/core";
import { parse as parseToml } from "@iarna/toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentAdapter } from "../src/adapter.js";
import { builtInAdapterDefinitions, builtInAdapterRegistry } from "../src/built-in.js";
import { UnsupportedMcpEnvReferenceError, UnsupportedMcpTransportError } from "../src/errors.js";
import { applyInstallPlans } from "../src/executor.js";
import { planInstall, planUninstall } from "../src/planner.js";
import { createAdapterRegistry } from "../src/registry.js";

const TARGETS = ["codex", "claude", "kimi"] as const;
type Target = (typeof TARGETS)[number];

let dir: string;
let fakeHome: string;
const savedEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentyx-compat-"));
  fakeHome = await mkdtemp(join(tmpdir(), "agentyx-compat-home-"));
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
});

afterEach(async () => {
  restore("HOME", savedEnv.HOME);
  restore("USERPROFILE", savedEnv.USERPROFILE);
  await rm(dir, { recursive: true, force: true });
  await rm(fakeHome, { recursive: true, force: true });
});

function restore(key: "HOME" | "USERPROFILE", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

interface SyncInput {
  readonly targets: readonly string[];
  readonly skills?: readonly string[];
  readonly agents?: readonly string[];
  readonly mcp?: readonly string[];
  readonly hooks?: readonly string[];
}

/** Plans and applies the way `sync` does: against the recorded manifest, with pruning. */
async function sync(input: SyncInput) {
  const manifest = await loadInstallManifest(dir);
  const plans = await planInstall({
    targets: input.targets,
    projectDir: dir,
    skills: (input.skills ?? []).map((name) => builtInSkillRegistry.get(name)),
    agents: (input.agents ?? []).map((name) => builtInAgentRegistry.get(name)),
    mcpServers: (input.mcp ?? []).map((name) => builtInMcpServerRegistry.get(name)),
    hooks: (input.hooks ?? []).map((name) => builtInHookRegistry.get(name)),
    manifest,
    prune: true,
  });
  await applyInstallPlans(plans, { manifest });
  return { plans, manifest: await loadInstallManifest(dir) };
}

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), content, "utf8");
}

const read = (path: string) => readFile(join(dir, path), "utf8");

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(join(dir, path));
    return true;
  } catch {
    return false;
  }
}

function frontmatter(markdown: string): { fields: Map<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(markdown);
  if (match === null) throw new Error(`Not Markdown with frontmatter:\n${markdown}`);
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split("\n")) {
    const separator = line.indexOf(": ");
    fields.set(line.slice(0, separator), line.slice(separator + 2));
  }
  return { fields, body: match[2] ?? "" };
}

describe("adapter references", () => {
  it("point every capability at an official provider documentation host", () => {
    const official = ["learn.chatgpt.com", "code.claude.com", "www.kimi.com"];
    for (const definition of builtInAdapterDefinitions) {
      const urls = [
        definition.reference,
        definition.mcp?.project === true ? definition.mcp.reference : undefined,
        definition.hooks?.reference,
        definition.agents?.reference,
      ].filter((url): url is string => url !== undefined);
      expect(urls.length).toBeGreaterThanOrEqual(3);
      for (const url of urls) {
        expect(official, `${definition.id}: ${url}`).toContain(new URL(url).hostname);
      }
    }
  });

  it("declares the destinations documented in docs/compatibility.md", async () => {
    const expected: Record<Target, string[]> = {
      codex: [".agents/skills/planning/SKILL.md", ".codex/agents/agentyx-reviewer.toml"],
      claude: [".claude/skills/planning/SKILL.md", ".claude/agents/agentyx-reviewer.md"],
      kimi: [".agents/skills/planning/SKILL.md", ".agents/agents/agentyx-reviewer.md"],
    };
    for (const target of TARGETS) {
      const [plan] = await planInstall({
        targets: [target],
        projectDir: dir,
        skills: [builtInSkillRegistry.get("planning")],
        agents: [builtInAgentRegistry.get("agentyx-reviewer")],
      });
      const paths = [
        ...(plan?.operations ?? []).map((operation) => operation.relativePath),
        ...(plan?.agentOperations ?? []).map((operation) => operation.relativePath),
      ];
      expect(paths.sort()).toEqual(expected[target].sort());
    }
  });
});

describe("canonical Skills across providers", () => {
  it("installs byte-identical content for every built-in Skill, from the real registry", async () => {
    await sync({ targets: TARGETS, skills: builtInSkillNames });

    for (const name of builtInSkillNames) {
      const canonical = formatSkillMarkdown(builtInSkillRegistry.get(name));
      expect(await read(`.agents/skills/${name}/SKILL.md`)).toBe(canonical);
      expect(await read(`.claude/skills/${name}/SKILL.md`)).toBe(canonical);
    }
  });
});

describe("project agent formats", () => {
  const definitions = builtInAgentNames.map((name) => builtInAgentRegistry.get(name));

  async function installAll(): Promise<void> {
    await sync({ targets: TARGETS, agents: builtInAgentNames });
  }

  it("renders Claude Code Markdown with an explicit tool allowlist and the canonical body", async () => {
    await installAll();
    for (const definition of definitions) {
      const { fields, body } = frontmatter(await read(`.claude/agents/${definition.name}.md`));
      expect(fields.get("name")).toBe(definition.name);
      expect(fields.get("description")).toBe(definition.description);
      expect(body.trim()).toBe(definition.instructions);
      expect([...fields.keys()].sort()).toEqual(["description", "name", "tools"]);
      expect(toolsFor(fields.get("tools"), definition)).toBe(true);
    }
  });

  it("renders Kimi Code Markdown that never overrides a built-in or delegates", async () => {
    await installAll();
    for (const definition of definitions) {
      const { fields, body } = frontmatter(await read(`.agents/agents/${definition.name}.md`));
      expect(fields.get("name")).toBe(definition.name);
      expect(fields.get("description")).toBe(definition.description);
      expect(fields.get("override")).toBe("false");
      expect(fields.has("subagents")).toBe(false);
      expect(body.trim()).toBe(definition.instructions);
      expect(toolsFor(fields.get("tools"), definition)).toBe(true);
    }
  });

  it("renders Codex TOML with the three required fields and a sandbox that matches access", async () => {
    await installAll();
    for (const definition of definitions) {
      const parsed = parseToml(await read(`.codex/agents/${definition.name}.toml`));
      expect(Object.keys(parsed).sort()).toEqual([
        "description",
        "developer_instructions",
        "name",
        "sandbox_mode",
      ]);
      expect(parsed.name).toBe(definition.name);
      expect(parsed.description).toBe(definition.description);
      expect(parsed.developer_instructions).toBe(definition.instructions);
      expect(parsed.sandbox_mode).toBe(
        definition.access === "read-only" ? "read-only" : "workspace-write",
      );
    }
  });

  it("keeps one canonical instruction body across all three providers", async () => {
    await installAll();
    for (const definition of definitions) {
      const claude = frontmatter(await read(`.claude/agents/${definition.name}.md`)).body.trim();
      const kimi = frontmatter(await read(`.agents/agents/${definition.name}.md`)).body.trim();
      const codex = parseToml(await read(`.codex/agents/${definition.name}.toml`));
      expect(new Set([claude, kimi, codex.developer_instructions])).toEqual(
        new Set([definition.instructions]),
      );
    }
  });

  it("never grants write, shell, delegation or wildcard tools to a read-only role", async () => {
    await installAll();
    const readOnly = definitions.filter((definition) => definition.access === "read-only");
    expect(readOnly.length).toBeGreaterThan(0);
    for (const definition of readOnly) {
      for (const path of [
        `.claude/agents/${definition.name}.md`,
        `.agents/agents/${definition.name}.md`,
      ]) {
        const tools = (frontmatter(await read(path)).fields.get("tools") ?? "").split(", ");
        expect(tools.sort()).toEqual(["Glob", "Grep", "Read"]);
      }
    }
  });

  it("grants a workspace-write role only file and shell tools, never delegation or wildcards", async () => {
    await installAll();
    const writer = definitions.find((definition) => definition.access === "workspace-write");
    expect(writer).toBeDefined();
    const tools = (
      frontmatter(await read(`.claude/agents/${writer?.name}.md`)).fields.get("tools") ?? ""
    ).split(", ");
    expect(tools.sort()).toEqual(["Bash", "Edit", "Glob", "Grep", "Read", "Write"]);
    expect(tools).not.toContain("*");
    expect(tools).not.toContain("Agent");
  });
});

/** The rendered allowlist matches the access level exactly. */
function toolsFor(tools: string | undefined, definition: AgentDefinition): boolean {
  const list = (tools ?? "").split(", ").sort();
  const expected =
    definition.access === "read-only"
      ? ["Glob", "Grep", "Read"]
      : ["Bash", "Edit", "Glob", "Grep", "Read", "Write"];
  return JSON.stringify(list) === JSON.stringify(expected);
}

describe("shared .agents directory lifecycle", () => {
  it("represents a file shared by Codex and Kimi once, owned by both", async () => {
    const { manifest, plans } = await sync({ targets: ["codex", "kimi"], skills: ["planning"] });
    const entries = manifest.entries.filter((entry) => entry.path.startsWith(".agents/skills"));

    expect(entries).toHaveLength(1);
    expect([...(entries[0]?.targets ?? [])].sort()).toEqual(["codex", "kimi"]);
    expect(plans.map((plan) => plan.operations[0]?.usedBy)).toEqual([
      ["codex", "kimi"],
      ["codex", "kimi"],
    ]);
  });

  it("prunes a shared file once, only when nothing resolves it, and spares user files", async () => {
    await put(".agents/skills/user-skill/SKILL.md", "user owned\n");
    await put(".agents/agents/user-agent.md", "user owned\n");
    await sync({ targets: ["codex", "kimi"], skills: ["planning"] });

    // Codex alone cannot take a file Kimi also records; the run must cover both owners.
    const [alone] = await planInstall({
      targets: ["codex"],
      projectDir: dir,
      skills: [],
      manifest: await loadInstallManifest(dir),
      prune: true,
    });
    expect(alone?.deletions).toEqual([]);
    expect(await exists(".agents/skills/planning/SKILL.md")).toBe(true);

    await sync({ targets: ["codex", "kimi"], skills: [] });
    expect(await exists(".agents/skills/planning/SKILL.md")).toBe(false);
    expect(await read(".agents/skills/user-skill/SKILL.md")).toBe("user owned\n");
    expect(await read(".agents/agents/user-agent.md")).toBe("user owned\n");
  });

  it("fails safely when two targets want the same path with different content", async () => {
    const make = (id: string, content: string): AgentAdapter => ({
      id,
      name: id,
      capabilities: {
        skills: true,
        mcp: { project: false, global: false },
        hooks: false,
        agents: false,
      },
      skillsPath: (projectDir) => join(projectDir, "shared"),
      detect: async () => ({
        target: id,
        skillsPath: "shared",
        present: false,
        configured: false,
      }),
      planFiles: () => [{ segments: ["shared", "SKILL.md"], content, skill: "planning" }],
    });
    const registry = createAdapterRegistry([make("one", "a\n"), make("two", "b\n")]);

    await expect(
      planInstall({
        targets: ["one", "two"],
        projectDir: dir,
        skills: [builtInSkillRegistry.get("planning")],
        registry,
      }),
    ).rejects.toMatchObject({ code: "shared_install_conflict" });
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("MCP provider formats", () => {
  const files: Record<Target, string> = {
    codex: ".codex/config.toml",
    claude: ".mcp.json",
    kimi: ".kimi-code/mcp.json",
  };
  const unrelated: Record<Target, string> = {
    codex: 'model = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "mine"\nargs = []\n',
    claude: JSON.stringify({ custom: true, mcpServers: { mine: { command: "mine" } } }),
    kimi: JSON.stringify({ custom: true, mcpServers: { mine: { command: "mine" } } }),
  };

  function servers(target: Target): Record<string, unknown> {
    const content = readSync(target);
    if (target === "codex") return parseToml(content).mcp_servers as Record<string, unknown>;
    return JSON.parse(content).mcpServers;
  }
  const contents = new Map<Target, string>();
  function readSync(target: Target): string {
    return contents.get(target) ?? "";
  }
  async function load(target: Target): Promise<void> {
    contents.set(target, await read(files[target]));
  }

  for (const target of TARGETS) {
    it(`${target}: preserves user entries through install, update, prune and uninstall`, async () => {
      await put(files[target], unrelated[target]);
      await sync({ targets: [target], mcp: ["context7", "supabase"] });
      await load(target);
      expect(Object.keys(servers(target)).sort()).toEqual(["context7", "mine", "supabase"]);
      expect(servers(target).mine).toMatchObject({ command: "mine" });

      // A hand-edit of an Agentyx-owned key is replaced by the declared definition on sync.
      const edited = readSync(target).replace(
        "https://mcp.context7.com/mcp",
        "https://example.test",
      );
      await put(files[target], edited);
      await sync({ targets: [target], mcp: ["context7", "supabase"] });
      await load(target);
      expect(JSON.stringify(servers(target).context7)).toContain("https://mcp.context7.com/mcp");

      // Prune removes only the Agentyx-owned key that no longer resolves.
      await sync({ targets: [target], mcp: ["context7"] });
      await load(target);
      expect(Object.keys(servers(target)).sort()).toEqual(["context7", "mine"]);

      // Uninstall removes the rest of Agentyx's keys and leaves the user's.
      const manifest = await loadInstallManifest(dir);
      await applyInstallPlans(
        await planUninstall({ targets: [target], projectDir: dir, manifest }),
        {
          manifest,
        },
      );
      await load(target);
      expect(Object.keys(servers(target))).toEqual(["mine"]);
      // Only an empty record of the user-owned file may remain; no server is still claimed.
      const left = await loadInstallManifest(dir);
      expect(left.entries.flatMap((entry) => (entry.kind === "mcp" ? entry.servers : []))).toEqual(
        [],
      );
    });
  }

  it("renders stdio and HTTP shapes in each provider's documented schema", () => {
    const stdio = mcpServerDefinitionSchema.parse({
      name: "docs",
      description: "Docs.",
      transport: "stdio",
      command: "npx",
      args: ["-y", "docs-server"],
      env: { DOCS_TOKEN: { fromEnv: "DOCS_TOKEN" } },
    });
    const http = mcpServerDefinitionSchema.parse({
      name: "remote",
      description: "Remote.",
      transport: "http",
      url: "https://example.test/mcp",
      headers: { "X-Api-Key": { fromEnv: "REMOTE_KEY" } },
    });

    const render = (target: Target, server: typeof stdio) => {
      const adapter = builtInAdapterRegistry.get(target);
      const rendered = adapter.planMcpConfig?.(
        { projectDir: dir, skills: [], mcpServers: [server], hooks: [], agents: [] },
        { content: undefined, remove: [] },
      );
      return rendered?.content ?? "";
    };

    // Codex: TOML, forwarded variables by name, headers mapped to variable names.
    const codexStdio = parseToml(render("codex", stdio)).mcp_servers as Record<string, unknown>;
    expect(codexStdio.docs).toMatchObject({
      command: "npx",
      args: ["-y", "docs-server"],
      env_vars: ["DOCS_TOKEN"],
    });
    expect(JSON.stringify(codexStdio.docs)).not.toContain('"DOCS_TOKEN":"DOCS_TOKEN"');
    const codexHttp = parseToml(render("codex", http)).mcp_servers as Record<string, unknown>;
    expect(codexHttp.remote).toMatchObject({
      url: "https://example.test/mcp",
      env_http_headers: { "X-Api-Key": "REMOTE_KEY" },
    });

    // Claude Code: ${VAR} expansion in env and headers, explicit type.
    expect(JSON.parse(render("claude", stdio)).mcpServers.docs).toMatchObject({
      type: "stdio",
      command: "npx",
      env: { DOCS_TOKEN: "${DOCS_TOKEN}" },
    });
    expect(JSON.parse(render("claude", http)).mcpServers.remote).toEqual({
      type: "http",
      url: "https://example.test/mcp",
      headers: { "X-Api-Key": "${REMOTE_KEY}" },
    });

    // Kimi Code: no documented reference syntax, so no literal variable name is ever written.
    const kimiStdio = JSON.parse(render("kimi", stdio)).mcpServers.docs;
    expect(kimiStdio).toEqual({ command: "npx", args: ["-y", "docs-server"], env: {} });
    expect(JSON.parse(render("kimi", http)).mcpServers.remote).toEqual({
      url: "https://example.test/mcp",
    });
  });

  it("refuses a Codex env reference it cannot forward under the same name", async () => {
    const renamed = mcpServerDefinitionSchema.parse({
      name: "renamed",
      description: "Renamed.",
      transport: "stdio",
      command: "npx",
      env: { EXPECTED_NAME: { fromEnv: "OTHER_NAME" } },
    });
    await expect(
      planInstall({ targets: ["codex"], projectDir: dir, skills: [], mcpServers: [renamed] }),
    ).rejects.toBeInstanceOf(UnsupportedMcpEnvReferenceError);
  });

  it("refuses a transport the adapter does not declare instead of rendering it", async () => {
    const stdioOnly = {
      ...builtInAdapterRegistry.get("claude"),
      id: "stdio-only",
      capabilities: {
        ...builtInAdapterRegistry.get("claude").capabilities,
        mcp: { project: true, global: false, transports: ["stdio"] },
      },
    } satisfies AgentAdapter;
    const registry = createAdapterRegistry([stdioOnly]);

    const error = await planInstall({
      targets: ["stdio-only"],
      projectDir: dir,
      skills: [],
      mcpServers: [builtInMcpServerRegistry.get("context7")],
      registry,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(UnsupportedMcpTransportError);
    expect(error).toMatchObject({ code: "unsupported_mcp_transport", transport: "http" });
    expect(await exists(".mcp.json")).toBe(false);
  });
});

describe("hook formats", () => {
  const userHook = {
    matcher: "Bash",
    hooks: [{ type: "command", command: "./my-lint.sh" }],
  };

  it("claude: preserves user hooks and is idempotent for Agentyx hooks", async () => {
    await put(".claude/settings.json", JSON.stringify({ hooks: { PostToolUse: [userHook] } }));
    const hooks = ["session-doctor-bootstrap", "observe-tool-use"];

    await sync({ targets: ["claude"], hooks });
    const first = await read(".claude/settings.json");
    await sync({ targets: ["claude"], hooks });
    expect(await read(".claude/settings.json")).toBe(first);

    const parsed = JSON.parse(first);
    expect(parsed.hooks.PostToolUse[0]).toEqual(userHook);
    expect(JSON.stringify(parsed)).toContain("agentyx:session-doctor-bootstrap");

    await sync({ targets: ["claude"], hooks: [] });
    expect(JSON.parse(await read(".claude/settings.json"))).toEqual({
      hooks: { PostToolUse: [userHook] },
    });
  });

  it("codex: writes .codex/hooks.json with identifiable markers and keeps user hooks", async () => {
    await put(".codex/hooks.json", JSON.stringify({ hooks: { PostToolUse: [userHook] } }));
    await sync({ targets: ["codex"], hooks: ["session-doctor-bootstrap"] });

    const parsed = JSON.parse(await read(".codex/hooks.json"));
    expect(parsed.hooks.PostToolUse[0]).toEqual(userHook);
    expect(JSON.stringify(parsed.hooks.SessionStart)).toContain("agentyx:session-doctor-bootstrap");
  });

  it("codex: stays conservative when .codex/config.toml already defines inline hooks", async () => {
    const inline = '[[hooks.PostToolUse]]\nmatcher = "Bash"\n';
    await put(".codex/config.toml", inline);
    await sync({ targets: ["codex"], hooks: ["session-doctor-bootstrap"] });

    expect(await exists(".codex/hooks.json")).toBe(false);
    expect(await read(".codex/config.toml")).toBe(inline);
  });

  it("kimi: installs no hooks and writes nothing under $HOME", async () => {
    const { manifest } = await sync({
      targets: ["kimi"],
      skills: ["planning"],
      hooks: ["session-doctor-bootstrap", "observe-tool-use"],
    });

    expect(manifest.entries.some((entry) => entry.kind === "hook")).toBe(false);
    expect(await exists(".kimi-code/config.toml")).toBe(false);
    expect(await readdir(fakeHome)).toEqual([]);
  });
});

describe("observability flags match the documented hook signals", () => {
  const flags = Object.fromEntries(
    TARGETS.map((id) => [id, builtInAdapterRegistry.get(id).capabilities.observability]),
  );

  it("Codex: lifecycle, tool and MCP use only — no Skill signal, no context size", () => {
    expect(flags.codex).toMatchObject({
      projectHooks: true,
      sessionLifecycle: true,
      toolUse: true,
      skillUse: false,
      mcpUse: true,
      contextTokens: false,
    });
  });

  it("Claude Code: adds Skill use and the resume-only SessionStart context size", () => {
    expect(flags.claude).toMatchObject({
      projectHooks: true,
      sessionLifecycle: true,
      toolUse: true,
      skillUse: true,
      mcpUse: true,
      contextTokens: true,
    });
  });

  it("Kimi Code: nothing is observable because hooks are user-level only", () => {
    expect(flags.kimi).toMatchObject({
      projectHooks: false,
      sessionLifecycle: false,
      toolUse: false,
      skillUse: false,
      mcpUse: false,
      contextTokens: false,
    });
    expect(flags.kimi?.reason).toContain("user-level");
  });
});

describe("manifest compatibility", () => {
  const hash = "0".repeat(64);
  // A lock as written before project agents existed (Agentyx 0.12.x): skill, MCP and hook entries.
  const preAgentManifest = {
    version: 1,
    entries: [
      {
        kind: "skill",
        path: ".agents/skills/planning/SKILL.md",
        skill: "planning",
        targets: ["codex", "kimi"],
        hash,
      },
      {
        kind: "mcp",
        path: ".mcp.json",
        servers: ["context7"],
        targets: ["claude"],
        hash,
        created: true,
      },
      {
        kind: "hook",
        path: ".claude/settings.json",
        hooks: ["session-doctor-bootstrap"],
        targets: ["claude"],
        hash,
        created: true,
      },
    ],
  };

  it("loads a pre-agent manifest unchanged", () => {
    const parsed = parseInstallManifest(preAgentManifest);
    expect(parsed.version).toBe(1);
    expect(parsed.entries.map((entry) => entry.kind)).toEqual(["skill", "mcp", "hook"]);
  });

  it("adds agent entries on sync without losing existing ownership, then is stable", async () => {
    const first = await sync({
      targets: TARGETS,
      skills: ["planning"],
      mcp: ["context7"],
      hooks: ["session-doctor-bootstrap"],
    });
    const before = first.manifest.entries.map((entry) => JSON.stringify(entry));
    expect(first.manifest.entries.some((entry) => entry.kind === "agent")).toBe(false);

    const withAgent = await sync({
      targets: TARGETS,
      skills: ["planning"],
      mcp: ["context7"],
      hooks: ["session-doctor-bootstrap"],
      agents: ["agentyx-reviewer"],
    });
    const after = withAgent.manifest.entries.map((entry) => JSON.stringify(entry));
    for (const entry of before) expect(after).toContain(entry);
    expect(withAgent.manifest.entries.filter((entry) => entry.kind === "agent")).toHaveLength(3);

    const lock = await read(".agentyx.lock.json");
    const again = await sync({
      targets: TARGETS,
      skills: ["planning"],
      mcp: ["context7"],
      hooks: ["session-doctor-bootstrap"],
      agents: ["agentyx-reviewer"],
    });
    expect(await read(".agentyx.lock.json")).toBe(lock);
    expect(
      again.plans
        .flatMap((plan) => [...plan.operations, ...plan.agentOperations])
        .every((operation) => operation.status === "unchanged"),
    ).toBe(true);
  });

  it("round-trips an empty manifest", () => {
    expect(parseInstallManifest(emptyInstallManifest()).entries).toEqual([]);
  });
});

describe("agent lifecycle preserves user files", () => {
  it("keeps user agents beside Agentyx agents through install, conflict and prune", async () => {
    const userFiles = {
      ".claude/agents/mine.md": "user\n",
      ".agents/agents/mine.md": "user\n",
      ".codex/agents/mine.toml": 'name = "mine"\n',
    };
    for (const [path, body] of Object.entries(userFiles)) await put(path, body);

    await sync({ targets: TARGETS, agents: ["agentyx-reviewer"] });
    for (const [path, body] of Object.entries(userFiles)) expect(await read(path)).toBe(body);

    await sync({ targets: TARGETS, agents: [] });
    expect(await exists(".claude/agents/agentyx-reviewer.md")).toBe(false);
    expect(await exists(".agents/agents/agentyx-reviewer.md")).toBe(false);
    expect(await exists(".codex/agents/agentyx-reviewer.toml")).toBe(false);
    for (const [path, body] of Object.entries(userFiles)) expect(await read(path)).toBe(body);
  });

  it("reports an unmanaged same-name agent as a conflict instead of overwriting it", async () => {
    await put(".claude/agents/agentyx-reviewer.md", "mine\n");
    const manifest = await loadInstallManifest(dir);
    const [plan] = await planInstall({
      targets: ["claude"],
      projectDir: dir,
      skills: [],
      agents: [builtInAgentRegistry.get("agentyx-reviewer")],
      manifest,
    });

    expect(plan?.agentOperations[0]?.status).toBe("conflict");
    expect(await read(".claude/agents/agentyx-reviewer.md")).toBe("mine\n");
  });

  it("writes nothing under $HOME for any target", async () => {
    await sync({
      targets: TARGETS,
      skills: ["planning"],
      agents: ["agentyx-planner"],
      mcp: ["context7"],
      hooks: ["session-doctor-bootstrap"],
    });
    expect(await readdir(fakeHome)).toEqual([]);
  });
});
