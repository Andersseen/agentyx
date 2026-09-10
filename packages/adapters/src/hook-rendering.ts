import { resolve } from "node:path";
import type { HookDefinition } from "@agentyx/core";
import type { ExistingHookConfig } from "./adapter.js";
import { ProviderConfigParseError } from "./errors.js";
import {
  isRecord,
  type JsonRecord,
  optionalRecord,
  parseJsonObject,
  sortRecord,
} from "./json-config.js";

export const CLAUDE_HOOKS_CONFIG_SEGMENTS = [".claude", "settings.json"] as const;

/** Every Agentyx-owned entry in `hooks.SessionStart` carries this prefix as its `statusMessage`. */
const AGENTYX_HOOK_MARKER = "agentyx:";

/** The matcher Agentyx registers its `SessionStart` hooks against — fresh sessions only. */
const SESSION_START_MATCHER = "startup";

export function claudeHooksConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CLAUDE_HOOKS_CONFIG_SEGMENTS);
}

/**
 * A provider hook config as Agentyx would leave it.
 *
 * `empty` reports that nothing is left in the document once Agentyx's own
 * entries are gone — the one condition under which removing the file itself is
 * safe, and something only the code that knows the format can determine.
 */
export interface RenderedHookConfig {
  readonly content: string;
  readonly empty: boolean;
}

/**
 * Merges resolved hooks into `.claude/settings.json`.
 *
 * `hooks.SessionStart` is an array of `{ matcher, hooks: [...] }` groups, not a
 * keyed object like MCP's `mcpServers`, so there is no natural key to diff
 * against. Agentyx recovers one by stamping every hook entry it writes with
 * `statusMessage: "agentyx:<hook name>"` — a real field Claude Code already
 * shows as the hook's spinner label, not a foreign addition. Every run strips
 * every `agentyx:`-tagged entry and regenerates the active ones fresh, the same
 * overwrite-in-place approach `renderClaudeMcpConfig` uses for `mcpServers`
 * keys; nothing else in the file is ever read or touched.
 */
export function renderClaudeHooksConfig(
  hooks: readonly HookDefinition[],
  existing: ExistingHookConfig,
): RenderedHookConfig {
  const path = CLAUDE_HOOKS_CONFIG_SEGMENTS.join("/");
  const config = parseJsonObject(existing.content, path);
  const hooksConfig = optionalRecord(config.hooks, path, "hooks");
  const sessionStart = stripAgentyxEntries(
    optionalArray(hooksConfig.SessionStart, path, "hooks.SessionStart"),
  );

  for (const hook of hooks) {
    addHookEntry(sessionStart, hook);
  }

  if (sessionStart.length > 0) {
    hooksConfig.SessionStart = sessionStart;
  } else {
    delete hooksConfig.SessionStart;
  }

  if (Object.keys(hooksConfig).length > 0) {
    config.hooks = hooksConfig;
  } else {
    delete config.hooks;
  }

  return {
    content: `${JSON.stringify(sortRecord(config), null, 2)}\n`,
    empty: Object.keys(config).length === 0,
  };
}

/** Drops every `SessionStart` group entry Agentyx previously added, and any group left empty. */
function stripAgentyxEntries(sessionStart: readonly JsonRecord[]): JsonRecord[] {
  return sessionStart
    .map((group) => ({
      ...group,
      hooks: optionalArray(group.hooks, "hooks.SessionStart[].hooks", "hooks").filter(
        (entry) => !isAgentyxEntry(entry),
      ),
    }))
    .filter((group) => group.hooks.length > 0);
}

function addHookEntry(sessionStart: JsonRecord[], hook: HookDefinition): void {
  const entry: JsonRecord = {
    type: "command",
    command: hook.command,
    args: hook.args,
    statusMessage: `${AGENTYX_HOOK_MARKER}${hook.name}`,
  };
  const group = sessionStart.find((candidate) => candidate.matcher === SESSION_START_MATCHER);

  if (group === undefined) {
    sessionStart.push({
      matcher: SESSION_START_MATCHER,
      hooks: [entry],
    });
    return;
  }

  (group.hooks as JsonRecord[]).push(entry);
}

function isAgentyxEntry(entry: unknown): boolean {
  return (
    isRecord(entry) &&
    typeof entry.statusMessage === "string" &&
    entry.statusMessage.startsWith(AGENTYX_HOOK_MARKER)
  );
}

function optionalArray(value: unknown, path: string, field: string): JsonRecord[] {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value) && value.every(isRecord)) {
    return value;
  }

  throw new ProviderConfigParseError(path, new Error(`${field} must be an array of objects`));
}
