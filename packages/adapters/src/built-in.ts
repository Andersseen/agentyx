import type { AgentAdapter } from "./adapter.js";
import { type AdapterRegistry, createAdapterRegistry } from "./registry.js";
import {
  createSkillDirectoryAdapter,
  type SkillDirectoryAdapterDefinition,
} from "./skill-directory.js";

/**
 * The providers Agentyx can install into, expressed as data.
 *
 * Both are project-local on purpose: Agentyx never writes into `$HOME`, so an
 * installation is reviewable in the project's own diff and disappears with the
 * checkout.
 *
 * The destinations are the providers' documented conventions, not invented
 * ones:
 *
 * - **Codex** reads repository skills from `.agents/skills`, the vendor-neutral
 *   location shared with other agents, which is also why the Codex adapter does
 *   not use a `.codex` directory.
 * - **Claude Code** reads project skills from `.claude/skills`.
 * - **Kimi Code** reads project skills from `.agents/skills`, the shared directory that Kimi
 *   documents alongside its `.kimi-code/skills` directory.
 * - **Codex MCP** uses project `.codex/config.toml` under `mcp_servers`. Codex only loads project
 *   `.codex/` layers for trusted projects, so Agentyx writes the project file and never falls back to
 *   `$HOME`.
 * - **Claude Code MCP** supports project scope in `.mcp.json` with an `mcpServers` object. Local
 *   and user MCP scopes live in `~/.claude.json`, which Agentyx deliberately does not mutate.
 * - **Kimi Code MCP** supports project scope in `.kimi-code/mcp.json` with an `mcpServers` object.
 *   Kimi also supports SSE, but Agentyx's provider-neutral MCP model currently covers stdio and HTTP.
 * - **Claude Code hooks** live in project-local `.claude/settings.json` under `hooks.<Event>`, so
 *   Agentyx can install a hook the same way it installs a Skill: inside the project, tracked by the
 *   manifest, removable by `uninstall`.
 * - **Codex hooks** are documented too: project-local `<repo>/.codex/hooks.json`, or inline
 *   `[hooks]` in `<repo>/.codex/config.toml`, loaded only for a trusted project layer. Non-managed
 *   hooks must also be reviewed and trusted by the user (`/hooks`) before they run; Agentyx never
 *   bypasses that, so a configured Codex hook is "configured", not "known to be active". Codex warns
 *   when one layer uses both representations, so Agentyx writes `hooks.json` only when the project
 *   has no inline `[hooks]`. Codex documents no Skill usage signal, so Skill use is unobservable.
 * - **Kimi Code supports lifecycle hooks**, but they are configured only in the user-level
 *   `~/.kimi-code/config.toml` `[[hooks]]` array, and plugin installation is per-user. "Kimi Code
 *   supports hooks" and "Agentyx has a safe project-local hook installation scope for Kimi Code" are
 *   different claims: only the first is true. Agentyx never writes under `$HOME` (rule 8), so it
 *   declares no `hooks` for Kimi Code and reports its runtime usage as unobservable. This is a limit
 *   of Agentyx's project-local safety policy, not of Kimi Code.
 *
 * Each definition also names the project-local paths that only that provider
 * creates. `.agents/skills` is shared by Codex and Kimi Code, so it cannot say
 * which agent a project uses; `.codex/`, `.claude/` and `.kimi-code/` can, and
 * that is what lets `init` propose the agents already in the checkout instead
 * of a fixed guess. Agentyx reads them and nothing more.
 *
 * Neither definition carries skill content: they are three fields and a
 * directory, and the instructions come from the Agentyx skill registry.
 */
export const builtInAdapterDefinitions: readonly SkillDirectoryAdapterDefinition[] = [
  {
    id: "codex",
    name: "Codex",
    skillsDir: [".agents", "skills"],
    markers: [[".codex"]],
    reference: "https://learn.chatgpt.com/docs/build-skills",
    mcp: {
      project: true,
      config: "codex-toml",
      transports: ["stdio", "http"],
      reference: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
    },
    hooks: {
      config: "codex-hooks-json",
      reference: "https://learn.chatgpt.com/docs/hooks",
    },
    agents: {
      dir: [".codex", "agents"],
      format: "codex",
      reference: "https://learn.chatgpt.com/docs/agent-configuration/subagents",
    },
    observability: {
      sessionLifecycle: true,
      toolUse: true,
      skillUse: false,
      mcpUse: true,
      contextTokens: false,
      reason: "Codex documents no Skill usage signal, so Skill activity cannot be observed.",
    },
  },
  {
    id: "claude",
    name: "Claude Code",
    skillsDir: [".claude", "skills"],
    markers: [[".claude"], ["CLAUDE.md"]],
    reference: "https://code.claude.com/docs/en/skills",
    mcp: {
      project: true,
      config: "claude-json",
      transports: ["stdio", "http"],
      reference: "https://code.claude.com/docs/en/mcp",
    },
    hooks: {
      config: "claude-settings-json",
      reference: "https://code.claude.com/docs/en/hooks",
    },
    agents: {
      dir: [".claude", "agents"],
      format: "claude",
      reference: "https://code.claude.com/docs/en/sub-agents",
    },
    observability: {
      sessionLifecycle: true,
      toolUse: true,
      skillUse: true,
      mcpUse: true,
      contextTokens: true,
    },
  },
  {
    id: "kimi",
    name: "Kimi Code",
    skillsDir: [".agents", "skills"],
    markers: [[".kimi-code"]],
    reference: "https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html",
    mcp: {
      project: true,
      config: "kimi-json",
      transports: ["stdio", "http"],
      reference: "https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html",
    },
    agents: {
      dir: [".agents", "agents"],
      format: "kimi",
      reference: "https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents.html",
    },
    observability: {
      sessionLifecycle: false,
      toolUse: false,
      skillUse: false,
      mcpUse: false,
      contextTokens: false,
      reason:
        "Kimi Code supports hooks, but only in user-level config; Agentyx has no safe " +
        "project-local installation for them and does not write under $HOME.",
    },
  },
];

/** The adapters Agentyx ships with, in listing order. */
export const builtInAdapters: readonly AgentAdapter[] = builtInAdapterDefinitions.map(
  createSkillDirectoryAdapter,
);

/** The registry used when no explicit registry is supplied. */
export const builtInAdapterRegistry: AdapterRegistry = createAdapterRegistry(builtInAdapters);
