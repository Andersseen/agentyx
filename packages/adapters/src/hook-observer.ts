import type { ObservationCapabilityKind, ObservationEvent } from "@agentyx/core";

/** What the observer already knows, so it only ever records identifiers Agentyx itself defines. */
export interface KnownCapabilities {
  readonly mcpServers: ReadonlySet<string>;
  readonly skills: ReadonlySet<string>;
}

/**
 * The metadata kept from one provider hook payload.
 *
 * `sessionId` is the provider's own id and exists only so the caller can hash it; it is never
 * stored. Nothing else from the payload — prompt, tool arguments, tool output, paths, commands —
 * is carried over.
 */
export interface NormalizedHookEvent {
  readonly sessionId: string;
  readonly event: ObservationEvent;
  readonly capabilityKind?: ObservationCapabilityKind;
  readonly capability?: string;
  readonly contextTokens?: number;
}

export type HookPayloadNormalizer = (
  payload: unknown,
  known: KnownCapabilities,
) => NormalizedHookEvent | undefined;

type Payload = Record<string, unknown>;

function asRecord(value: unknown): Payload | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Payload)
    : undefined;
}

function text(value: unknown, max = 256): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
}

/**
 * Maps `mcp__<server>__<tool>` to an Agentyx MCP id.
 *
 * Only the server segment is read — the tool name is discarded. Providers normalize server names
 * (hyphens can become underscores), so both spellings are tried; anything that does not match a
 * server Agentyx defines is ignored rather than recorded.
 */
export function mcpServerFromToolName(
  toolName: string,
  known: ReadonlySet<string>,
): string | undefined {
  const match = /^mcp__(.+?)__.+$/.exec(toolName);
  const server = match?.[1];

  if (server === undefined) {
    return undefined;
  }

  return [server, server.replaceAll("_", "-")].find((candidate) => known.has(candidate));
}

/** Common to every provider that sends `session_id` and `hook_event_name`. */
function normalizeCommon(
  payload: unknown,
  known: KnownCapabilities,
  extra: (name: string, body: Payload, sessionId: string) => NormalizedHookEvent | undefined,
): NormalizedHookEvent | undefined {
  const body = asRecord(payload);
  const sessionId = text(body?.session_id, 512);
  const name = text(body?.hook_event_name, 64);

  if (body === undefined || sessionId === undefined || name === undefined) {
    return undefined;
  }

  if (name === "SessionStart") {
    const tokens = body.context_tokens;

    return {
      sessionId,
      event: "session-start",
      ...(typeof tokens === "number" && Number.isInteger(tokens) && tokens >= 0
        ? { contextTokens: tokens }
        : {}),
    };
  }

  if (name === "SessionEnd") {
    return { sessionId, event: "session-end" };
  }

  if (name === "PostToolUse") {
    const toolName = text(body.tool_name, 256);

    if (toolName === undefined) {
      return undefined;
    }

    const server = mcpServerFromToolName(toolName, known.mcpServers);

    if (server !== undefined) {
      return { sessionId, event: "mcp-used", capabilityKind: "mcp", capability: server };
    }
  }

  return extra(name, body, sessionId);
}

/**
 * Codex: session lifecycle and MCP use. Codex documents no Skill usage signal, so Skills are
 * reported as unobservable rather than inferred from its undocumented transcript.
 */
export const normalizeCodexHook: HookPayloadNormalizer = (payload, known) =>
  normalizeCommon(payload, known, () => undefined);

/**
 * Claude Code: everything Codex gives, plus Skills — through the `Skill` tool, or, for a directly
 * typed `/skill`, `UserPromptExpansion`. Only the Skill's identifier is kept, never its arguments.
 */
export const normalizeClaudeHook: HookPayloadNormalizer = (payload, known) =>
  normalizeCommon(payload, known, (name, body, sessionId) => {
    let skill: string | undefined;

    if (name === "PostToolUse" && body.tool_name === "Skill") {
      skill = text(asRecord(body.tool_input)?.skill);
    } else if (name === "UserPromptExpansion" && body.expansion_type === "slash_command") {
      skill = text(body.command_name);
    }

    // Plugin skills are namespaced `plugin:skill`.
    skill = skill?.split(":").at(-1);

    return skill !== undefined && known.skills.has(skill)
      ? { sessionId, event: "skill-used", capabilityKind: "skill", capability: skill }
      : undefined;
  });
