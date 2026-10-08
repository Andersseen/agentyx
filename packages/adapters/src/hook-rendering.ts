import { resolve } from "node:path";
import type { HookDefinition } from "@agentyx/core";
import { parse as parseToml } from "@iarna/toml";
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
export const CODEX_HOOKS_CONFIG_SEGMENTS = [".codex", "hooks.json"] as const;
/** Codex also reads inline `[hooks]` from here; see {@link hasInlineCodexHooks}. */
export const CODEX_INLINE_HOOKS_SEGMENTS = [".codex", "config.toml"] as const;

/** Every Agentyx-owned hook entry carries this prefix as its `statusMessage`. */
export const AGENTYX_HOOK_MARKER = "agentyx:";

/** The matcher Agentyx registers a `SessionStart` hook against when it declares none: fresh sessions only. */
const SESSION_START_MATCHER = "startup";

/**
 * Hook events only Claude Code has. They stay in the adapter: the provider-neutral hook model does
 * not grow a Claude-only event. `UserPromptExpansion` is how a directly typed `/skill` is seen.
 */
const CLAUDE_EXTRA_EVENTS: Readonly<Record<string, readonly string[]>> = {
  "observe-tool-use": ["UserPromptExpansion"],
};

export type HookConfigFlavor = "claude" | "codex";

export function claudeHooksConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CLAUDE_HOOKS_CONFIG_SEGMENTS);
}

export function codexHooksConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CODEX_HOOKS_CONFIG_SEGMENTS);
}

export function codexInlineHooksConfigPath(projectDir: string): string {
  return resolve(projectDir, ...CODEX_INLINE_HOOKS_SEGMENTS);
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

/** Whether `.codex/config.toml` already defines hooks inline. */
export function hasInlineCodexHooks(tomlContent: string | undefined): boolean {
  if (tomlContent === undefined) {
    return false;
  }

  try {
    const hooks = (parseToml(tomlContent) as JsonRecord).hooks;

    return isRecord(hooks) && Object.keys(hooks).length > 0;
  } catch {
    return false;
  }
}

/**
 * Merges resolved hooks into a provider's JSON hook document
 * (`.claude/settings.json` or `.codex/hooks.json`; both use `hooks.<Event>[] = { matcher, hooks[] }`).
 *
 * Each event is an array of groups, not a keyed object like MCP's `mcpServers`, so there is no
 * natural key to diff against. Agentyx recovers one by stamping every hook entry it writes with
 * `statusMessage: "agentyx:<hook name>"` — a real field both providers already show as the hook's
 * spinner label. Every run strips every `agentyx:`-tagged entry from every event and regenerates
 * the active ones fresh; nothing else in the file is ever read or touched.
 */
export function renderJsonHooksConfig(
  flavor: HookConfigFlavor,
  providerId: string,
  hooks: readonly HookDefinition[],
  existing: ExistingHookConfig,
): RenderedHookConfig {
  const path = (
    flavor === "claude" ? CLAUDE_HOOKS_CONFIG_SEGMENTS : CODEX_HOOKS_CONFIG_SEGMENTS
  ).join("/");
  const config = parseJsonObject(existing.content, path);
  const hooksConfig = optionalRecord(config.hooks, path, "hooks");
  const events: Record<string, JsonRecord[]> = {};

  for (const [event, value] of Object.entries(hooksConfig)) {
    const groups = stripAgentyxEntries(optionalArray(value, path, `hooks.${event}`));

    if (groups.length > 0) {
      events[event] = groups;
    }
  }

  for (const hook of hooks) {
    const targets =
      flavor === "claude" ? [hook.event, ...(CLAUDE_EXTRA_EVENTS[hook.name] ?? [])] : [hook.event];

    for (const event of targets) {
      const groups = events[event] ?? [];

      events[event] = groups;
      addHookEntry(groups, event, hook, flavor, providerId);
    }
  }

  if (Object.keys(events).length > 0) {
    config.hooks = events;
  } else {
    delete config.hooks;
  }

  return {
    content: `${JSON.stringify(sortRecord(config), null, 2)}\n`,
    empty: Object.keys(config).length === 0,
  };
}

/** Drops every group entry Agentyx previously added, and any group left empty. */
function stripAgentyxEntries(groups: readonly JsonRecord[]): JsonRecord[] {
  return groups
    .map((group) => ({
      ...group,
      hooks: optionalArray(group.hooks, "hooks[].hooks", "hooks").filter(
        (entry) => !isAgentyxEntry(entry),
      ),
    }))
    .filter((group) => group.hooks.length > 0);
}

function addHookEntry(
  groups: JsonRecord[],
  event: string,
  hook: HookDefinition,
  flavor: HookConfigFlavor,
  providerId: string,
): void {
  const args = hook.args.map((arg) => arg.replaceAll("{provider}", providerId));
  const entry: JsonRecord = {
    type: "command",
    ...(flavor === "claude"
      ? { command: hook.command, args }
      : { command: [hook.command, ...args].map(shellQuote).join(" ") }),
    statusMessage: `${AGENTYX_HOOK_MARKER}${hook.name}`,
    ...(hook.timeout === undefined ? {} : { timeout: hook.timeout }),
    ...(hook.async === true ? { async: true } : {}),
  };
  const matcher = hook.matcher ?? (event === "SessionStart" ? SESSION_START_MATCHER : undefined);
  const group = groups.find((candidate) => candidate.matcher === matcher);

  if (group === undefined) {
    groups.push({ ...(matcher === undefined ? {} : { matcher }), hooks: [entry] });
    return;
  }

  (group.hooks as JsonRecord[]).push(entry);
}

/** Codex takes a single shell string; quote anything that is not plainly safe. */
function shellQuote(value: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

export function isAgentyxEntry(entry: unknown): boolean {
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

/** True when a hook document already contains an Agentyx-tagged entry. */
export function containsAgentyxHooks(content: string | undefined): boolean {
  if (content === undefined) {
    return false;
  }

  try {
    const hooks = (JSON.parse(content) as JsonRecord).hooks;

    return (
      isRecord(hooks) &&
      Object.values(hooks).some(
        (groups) =>
          Array.isArray(groups) &&
          groups.some(
            (group) =>
              isRecord(group) && Array.isArray(group.hooks) && group.hooks.some(isAgentyxEntry),
          ),
      )
    );
  } catch {
    return false;
  }
}
