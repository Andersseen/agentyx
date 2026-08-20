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
    reference: "https://developers.openai.com/codex/skills",
    mcp: {
      project: true,
      config: "codex-toml",
      transports: ["stdio", "http"],
      reference: "https://developers.openai.com/codex/mcp",
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
      reference: "https://docs.anthropic.com/en/docs/claude-code/mcp",
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
  },
];

/** The adapters Agentyx ships with, in listing order. */
export const builtInAdapters: readonly AgentAdapter[] = builtInAdapterDefinitions.map(
  createSkillDirectoryAdapter,
);

/** The registry used when no explicit registry is supplied. */
export const builtInAdapterRegistry: AdapterRegistry = createAdapterRegistry(builtInAdapters);
