import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { formatSkillMarkdown } from "@agentyx/core";
import type { AdapterContext, AgentAdapter, PlannedFile } from "./adapter.js";
import {
  CLAUDE_MCP_CONFIG_SEGMENTS,
  CODEX_MCP_CONFIG_SEGMENTS,
  claudeMcpConfigPath,
  codexMcpConfigPath,
  KIMI_MCP_CONFIG_SEGMENTS,
  kimiMcpConfigPath,
  renderClaudeMcpConfig,
  renderCodexMcpConfig,
  renderKimiMcpConfig,
} from "./mcp-rendering.js";

/** The file name every provider in this family expects inside a skill directory. */
export const SKILL_FILENAME = "SKILL.md";

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
  /** Why this location — kept next to the value so the choice stays auditable. */
  readonly reference: string;
  readonly mcp?:
    | {
        readonly project: true;
        readonly config: "codex-toml" | "claude-json" | "kimi-json";
        readonly transports: readonly string[];
        readonly reference: string;
      }
    | {
        readonly project: false;
      };
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
  const adapter: AgentAdapter = {
    id: definition.id,
    name: definition.name,
    capabilities: {
      skills: true,
      mcp: {
        project: definition.mcp?.project ?? false,
        global: false,
        transports: definition.mcp?.project === true ? definition.mcp.transports : [],
      },
    },
    references:
      definition.mcp?.project === true
        ? [definition.reference, definition.mcp.reference]
        : [definition.reference],
    skillsPath,
    detect: async (projectDir) => {
      const path = skillsPath(projectDir);

      return { target: definition.id, skillsPath: path, present: await isDirectory(path) };
    },
    planFiles: (context: AdapterContext): readonly PlannedFile[] =>
      context.skills.map((skill) => ({
        segments: [...definition.skillsDir, skill.name, SKILL_FILENAME],
        content: formatSkillMarkdown(skill),
        skill: skill.name,
      })),
  };

  if (definition.mcp?.project !== true) {
    return adapter;
  }

  const config = definition.mcp.config;

  const mcpConfigPath =
    config === "codex-toml"
      ? codexMcpConfigPath
      : config === "claude-json"
        ? claudeMcpConfigPath
        : kimiMcpConfigPath;
  const mcpConfigSegments =
    config === "codex-toml"
      ? CODEX_MCP_CONFIG_SEGMENTS
      : config === "claude-json"
        ? CLAUDE_MCP_CONFIG_SEGMENTS
        : KIMI_MCP_CONFIG_SEGMENTS;
  const renderMcpConfig =
    config === "codex-toml"
      ? renderCodexMcpConfig
      : config === "claude-json"
        ? renderClaudeMcpConfig
        : renderKimiMcpConfig;

  return {
    ...adapter,
    mcpConfigPath,
    planMcpConfig: (context: AdapterContext, existingContent: string | undefined) => ({
      segments: mcpConfigSegments,
      content: renderMcpConfig(context.mcpServers ?? [], existingContent),
      servers: (context.mcpServers ?? []).map((server) => server.name),
    }),
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
