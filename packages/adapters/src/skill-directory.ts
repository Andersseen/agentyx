import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentDefinition, McpServerDefinition } from "@agentyx/core";
import { formatSkillMarkdown } from "@agentyx/core";
import type {
  AdapterContext,
  AdapterObservability,
  AgentAdapter,
  ExistingHookConfig,
  ExistingMcpConfig,
  HookInstallStatus,
  PlannedAgentFile,
  PlannedFile,
} from "./adapter.js";
import type { HookPayloadNormalizer } from "./hook-observer.js";
import { normalizeClaudeHook, normalizeCodexHook, normalizeQwenHook } from "./hook-observer.js";
import {
  CLAUDE_HOOKS_CONFIG_SEGMENTS,
  CODEX_HOOKS_CONFIG_SEGMENTS,
  claudeHooksConfigPath,
  codexHooksConfigPath,
  codexInlineHooksConfigPath,
  containsAgentyxHooks,
  type HookConfigFlavor,
  hasInlineCodexHooks,
  QWEN_HOOKS_CONFIG_SEGMENTS,
  qwenHooksConfigPath,
  renderJsonHooksConfig,
} from "./hook-rendering.js";
import {
  CLAUDE_MCP_CONFIG_SEGMENTS,
  CODEX_MCP_CONFIG_SEGMENTS,
  claudeMcpConfigPath,
  codexMcpConfigPath,
  KIMI_MCP_CONFIG_SEGMENTS,
  kimiMcpConfigPath,
  QWEN_MCP_CONFIG_SEGMENTS,
  qwenMcpConfigPath,
  type RenderedMcpConfig,
  renderClaudeMcpConfig,
  renderCodexMcpConfig,
  renderKimiMcpConfig,
  renderQwenMcpConfig,
} from "./mcp-rendering.js";

/** The file name every provider in this family expects inside a skill directory. */
export const SKILL_FILENAME = "SKILL.md";

/** The MCP document formats Agentyx can render. */
export type McpConfigKind = "codex-toml" | "claude-json" | "kimi-json" | "qwen-json";

interface McpConfigShape {
  readonly path: (projectDir: string) => string;
  readonly segments: readonly string[];
  readonly render: (
    servers: readonly McpServerDefinition[],
    existing: ExistingMcpConfig,
  ) => RenderedMcpConfig;
}

/** Where each provider's project MCP document lives, and how it is rendered. */
const MCP_CONFIGS: Readonly<Record<McpConfigKind, McpConfigShape>> = {
  "codex-toml": {
    path: codexMcpConfigPath,
    segments: CODEX_MCP_CONFIG_SEGMENTS,
    render: renderCodexMcpConfig,
  },
  "claude-json": {
    path: claudeMcpConfigPath,
    segments: CLAUDE_MCP_CONFIG_SEGMENTS,
    render: renderClaudeMcpConfig,
  },
  "kimi-json": {
    path: kimiMcpConfigPath,
    segments: KIMI_MCP_CONFIG_SEGMENTS,
    render: renderKimiMcpConfig,
  },
  "qwen-json": {
    path: qwenMcpConfigPath,
    segments: QWEN_MCP_CONFIG_SEGMENTS,
    render: renderQwenMcpConfig,
  },
};

/** The hook document formats Agentyx can render. */
export type HookConfigKind = "claude-settings-json" | "codex-hooks-json" | "qwen-settings-json";

interface HookConfigShape {
  readonly flavor: HookConfigFlavor;
  readonly path: (projectDir: string) => string;
  readonly segments: readonly string[];
  readonly observe: HookPayloadNormalizer;
  readonly trust: HookInstallStatus["trust"];
  /** A second file the provider also reads hooks from; only Codex has one. */
  readonly inlineSiblingPath?: (projectDir: string) => string;
}

/**
 * Where each provider's project hook document lives, and what Agentyx can vouch for afterwards.
 *
 * `trust` belongs to the provider, not to the file format: Codex asks the user to review project
 * hooks through `/hooks`, and Qwen Code loads project hooks only for a folder the user has trusted,
 * while Claude Code has no such gate.
 */
const HOOK_CONFIGS: Readonly<Record<HookConfigKind, HookConfigShape>> = {
  "claude-settings-json": {
    flavor: "claude",
    path: claudeHooksConfigPath,
    segments: CLAUDE_HOOKS_CONFIG_SEGMENTS,
    observe: normalizeClaudeHook,
    trust: "unknown",
  },
  "codex-hooks-json": {
    flavor: "codex",
    path: codexHooksConfigPath,
    segments: CODEX_HOOKS_CONFIG_SEGMENTS,
    observe: normalizeCodexHook,
    trust: "review-may-be-required",
    inlineSiblingPath: codexInlineHooksConfigPath,
  },
  "qwen-settings-json": {
    flavor: "qwen",
    path: qwenHooksConfigPath,
    segments: QWEN_HOOKS_CONFIG_SEGMENTS,
    observe: normalizeQwenHook,
    trust: "review-may-be-required",
  },
};

/** The agent file formats Agentyx can render, named for the provider that documents them. */
export type AgentFormat = "claude" | "kimi" | "codex" | "qwen";

/**
 * The tool allowlist an agent gets per access level, in each provider's own tool names.
 *
 * A read-only role receives no write, shell or delegation tool; a workspace-write role adds file
 * and shell tools and still no delegation. The names differ because they are the provider's, not
 * Agentyx's: Qwen Code spells them `read_file` and `run_shell_command`, the others `Read` and
 * `Bash`. Codex expresses access as `sandbox_mode` instead of an allowlist, so it has none.
 */
const AGENT_TOOLS: Readonly<
  Record<AgentFormat, Record<AgentDefinition["access"], readonly string[]>>
> = {
  claude: {
    "read-only": ["Read", "Grep", "Glob"],
    "workspace-write": ["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
  },
  kimi: {
    "read-only": ["Read", "Grep", "Glob"],
    "workspace-write": ["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
  },
  qwen: {
    "read-only": ["read_file", "grep_search", "glob"],
    "workspace-write": [
      "read_file",
      "grep_search",
      "glob",
      "run_shell_command",
      "write_file",
      "edit",
    ],
  },
  codex: { "read-only": [], "workspace-write": [] },
};

/** What distinguishes one skill-directory provider from another: an id, a name, a location. */
export interface SkillDirectoryAdapterDefinition {
  readonly id: string;
  readonly name: string;
  /**
   * Directory segments below the project root that this provider scans for
   * skills, for example `[".claude", "skills"]`. Segments, not a string, so no
   * separator is ever written by hand.
   */
  readonly skillsDir: readonly string[];
  /**
   * Project-local paths that only this provider creates, as segments. Their
   * presence is what lets Agentyx offer a provider as a default instead of
   * guessing; `skillsDir` cannot serve here because providers share it.
   *
   * Agentyx only ever reads these — they are never planned, written or removed.
   */
  readonly markers: readonly (readonly string[])[];
  /** Why this location — kept next to the value so the choice stays auditable. */
  readonly reference: string;
  readonly mcp?:
    | {
        readonly project: true;
        readonly config: McpConfigKind;
        readonly transports: readonly string[];
        readonly reference: string;
      }
    | {
        readonly project: false;
      };
  /** Present only for providers with a documented project-local hook mechanism Agentyx can target. */
  readonly hooks?: {
    readonly config: HookConfigKind;
    readonly reference: string;
  };
  readonly agents?: {
    readonly dir: readonly string[];
    readonly format: AgentFormat;
    readonly reference: string;
  };
  /** What the provider documents as observable through its hooks. */
  readonly observability?: Omit<AdapterObservability, "projectHooks">;
}

/**
 * Builds an adapter for the providers that read skills as
 * `<skills directory>/<skill name>/SKILL.md`.
 *
 * Codex, Claude Code and Kimi Code all work this way, and all consume the
 * canonical `SKILL.md` that `@agentyx/core` renders, so the *only* thing that
 * differs between them is the directory. Sharing the mechanism here is what
 * keeps that true: neither provider owns skill content, a serializer, or
 * install logic.
 *
 * A provider that genuinely needs a different file layout implements
 * `AgentAdapter` directly instead of using this.
 *
 * Ownership: the generated paths are derived entirely from resolved skill
 * names, so Agentyx only ever manages `<skills directory>/<skill name>/SKILL.md`
 * for skills it resolved. Anything else in the provider's directory — other
 * skills, settings files — is never read, planned or written.
 */
export function createSkillDirectoryAdapter(
  definition: SkillDirectoryAdapterDefinition,
): AgentAdapter {
  const skillsPath = (projectDir: string): string =>
    resolve(projectDir, join(...definition.skillsDir));
  const references = [definition.reference];

  if (definition.mcp?.project === true) {
    references.push(definition.mcp.reference);
  }

  if (definition.hooks !== undefined) {
    references.push(definition.hooks.reference);
  }
  if (definition.agents !== undefined) references.push(definition.agents.reference);

  let adapter: AgentAdapter = {
    id: definition.id,
    name: definition.name,
    capabilities: {
      skills: true,
      mcp: {
        project: definition.mcp?.project ?? false,
        global: false,
        transports: definition.mcp?.project === true ? definition.mcp.transports : [],
      },
      hooks: definition.hooks !== undefined,
      agents: definition.agents !== undefined,
      observability: {
        sessionLifecycle: false,
        toolUse: false,
        skillUse: false,
        mcpUse: false,
        contextTokens: false,
        ...definition.observability,
        projectHooks: definition.hooks !== undefined,
      },
    },
    references,
    skillsPath,
    detect: async (projectDir) => {
      const path = skillsPath(projectDir);
      const [present, configured] = await Promise.all([
        isDirectory(path),
        hasAnyMarker(projectDir, definition.markers),
      ]);

      return { target: definition.id, skillsPath: path, present, configured };
    },
    planFiles: (context: AdapterContext): readonly PlannedFile[] =>
      context.skills.map((skill) => ({
        segments: [...definition.skillsDir, skill.name, SKILL_FILENAME],
        content: formatSkillMarkdown(skill),
        skill: skill.name,
      })),
  };

  if (definition.agents !== undefined) {
    const agentSettings = definition.agents;
    adapter = {
      ...adapter,
      agentsPath: (projectDir) => resolve(projectDir, join(...agentSettings.dir)),
      planAgents: (context): readonly PlannedAgentFile[] =>
        (context.agents ?? []).map((agent) => ({
          segments: [
            ...agentSettings.dir,
            `${agent.name}.${agentSettings.format === "codex" ? "toml" : "md"}`,
          ],
          content: renderAgent(agent, agentSettings.format),
          agent: agent.name,
        })),
    };
  }

  if (definition.mcp?.project === true) {
    const config = MCP_CONFIGS[definition.mcp.config];

    adapter = {
      ...adapter,
      mcpConfigPath: config.path,
      planMcpConfig: (context: AdapterContext, existing: ExistingMcpConfig) => {
        const rendered = config.render(context.mcpServers ?? [], existing);

        return {
          segments: config.segments,
          content: rendered.content,
          empty: rendered.empty,
          servers: (context.mcpServers ?? []).map((server) => server.name),
        };
      },
    };
  }

  if (definition.hooks !== undefined) {
    const config = HOOK_CONFIGS[definition.hooks.config];
    const { flavor, segments, path: hooksPath } = config;
    // Only Codex reads hooks from two representations in one layer.
    const siblingPath = config.inlineSiblingPath;

    adapter = {
      ...adapter,
      hooksConfigPath: hooksPath,
      observeHook: config.observe,
      ...(siblingPath === undefined ? {} : { hooksSiblingConfigPath: siblingPath }),
      planHookConfig: (context: AdapterContext, existing: ExistingHookConfig) => {
        const hooks = context.hooks ?? [];
        // Codex warns when one layer defines hooks both in hooks.json and inline. If the project
        // already uses inline hooks and has no hooks.json, do not create a second source.
        const inline =
          siblingPath !== undefined &&
          existing.content === undefined &&
          hasInlineCodexHooks(existing.sibling);
        const rendered = renderJsonHooksConfig(
          flavor,
          definition.id,
          inline ? [] : hooks,
          existing,
        );

        return {
          segments,
          content: rendered.content,
          empty: rendered.empty,
          hooks: inline ? [] : hooks.map((hook) => hook.name),
          ...(inline && hooks.length > 0
            ? {
                skipped:
                  ".codex/config.toml already defines inline [hooks]; Agentyx does not add a " +
                  "second .codex/hooks.json (Codex warns about two sources in one layer).",
              }
            : {}),
        };
      },
      inspectHooks: async (projectDir): Promise<HookInstallStatus> => {
        const path = hooksPath(projectDir);
        const [content, sibling] = await Promise.all([
          readOptional(path),
          siblingPath === undefined ? undefined : readOptional(siblingPath(projectDir)),
        ]);
        const configured = containsAgentyxHooks(content);
        const inline =
          siblingPath !== undefined && content === undefined && hasInlineCodexHooks(sibling);

        return {
          path: segments.join("/"),
          configured,
          trust: config.trust,
          ...(inline
            ? {
                note: ".codex/config.toml defines inline hooks, so Agentyx did not add .codex/hooks.json.",
              }
            : {}),
        };
      },
    };
  }

  return adapter;
}

function renderAgent(agent: AgentDefinition, format: AgentFormat): string {
  if (format === "codex")
    return `name = ${JSON.stringify(agent.name)}\ndescription = ${JSON.stringify(agent.description)}\nsandbox_mode = ${JSON.stringify(agent.access === "read-only" ? "read-only" : "workspace-write")}\ndeveloper_instructions = ${JSON.stringify(agent.instructions)}\n`;

  const tools = AGENT_TOOLS[format][agent.access];
  // Qwen Code documents `tools` as a YAML list of its own snake_case tool names; Claude Code and
  // Kimi Code take a comma-separated string of PascalCase ones.
  const toolsField =
    format === "qwen"
      ? `tools:\n${tools.map((tool) => `  - ${tool}`).join("\n")}\n`
      : `tools: ${tools.join(", ")}\n`;

  return `---\nname: ${agent.name}\ndescription: ${agent.description}\n${toolsField}${format === "kimi" ? "override: false\n" : ""}---\n\n${agent.instructions}\n`;
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

/** True as soon as one marker exists, whether it is a file or a directory. */
async function hasAnyMarker(
  projectDir: string,
  markers: readonly (readonly string[])[],
): Promise<boolean> {
  const results = await Promise.all(
    markers.map((segments) => exists(resolve(projectDir, join(...segments)))),
  );

  return results.some(Boolean);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
