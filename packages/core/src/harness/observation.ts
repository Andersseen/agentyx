import { createHash } from "node:crypto";
import { z } from "zod";

/** Version of the observation record; bumping it starts a new state file. */
export const OBSERVATION_VERSION = 1;

/** Normalized, provider-neutral events. Deliberately small. */
export const OBSERVATION_EVENTS = [
  "session-start",
  "session-end",
  "skill-used",
  "mcp-used",
  "tool-used",
  "hook-ran",
] as const;

export const OBSERVATION_CAPABILITY_KINDS = ["skill", "mcp", "tool", "hook"] as const;

export type ObservationEvent = (typeof OBSERVATION_EVENTS)[number];
export type ObservationCapabilityKind = (typeof OBSERVATION_CAPABILITY_KINDS)[number];

/**
 * One observed fact about a session — metadata only.
 *
 * There is no field for a prompt, a response, source code, tool arguments or output, a file name or
 * a command, so none can be stored: the schema is strict and a record carrying anything else is
 * rejected as a whole.
 */
export const harnessObservationSchema = z.strictObject({
  version: z.literal(OBSERVATION_VERSION),
  timestamp: z.string().datetime(),
  provider: z.string().min(1).max(64),
  /** Opaque key from {@link hashSessionKey}; never the provider's own session id. */
  session: z.string().regex(/^[0-9a-f]{16}$/),
  event: z.enum(OBSERVATION_EVENTS),
  capabilityKind: z.enum(OBSERVATION_CAPABILITY_KINDS).optional(),
  capability: z.string().min(1).max(128).optional(),
  /** Provider-reported context size, when the provider supplies one. */
  contextTokens: z.number().int().nonnegative().max(1_000_000_000).optional(),
  /** Collapsed repeats of an otherwise identical record; absent means 1. */
  count: z.number().int().positive().optional(),
});

export type HarnessObservation = z.infer<typeof harnessObservationSchema>;

/**
 * A deterministic, opaque session key.
 *
 * Agentyx only needs to know whether two observations came from the same session, so the provider's
 * own session id is hashed with the provider id and discarded.
 */
export function hashSessionKey(provider: string, providerSessionId: string): string {
  return createHash("sha256")
    .update(`agentyx-session\0${provider}\0${providerSessionId}`)
    .digest("hex")
    .slice(0, 16);
}

/** Parses one JSONL line, returning `undefined` for anything that is not a valid observation. */
export function parseObservationLine(line: string): HarnessObservation | undefined {
  if (line.trim() === "") {
    return undefined;
  }

  try {
    const parsed = harnessObservationSchema.safeParse(JSON.parse(line));

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
