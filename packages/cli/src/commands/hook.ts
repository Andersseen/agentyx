import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  builtInMcpServerNames,
  builtInSkillNames,
  type HarnessObservation,
  hashSessionKey,
  OBSERVATION_VERSION,
  recordObservation,
} from "@agentyx/core";
import { Command } from "commander";

/** Provider hook payloads are small; anything larger is not a payload this command wants. */
const MAX_PAYLOAD_BYTES = 256 * 1024;

export interface HookObserveInput {
  readonly provider: string;
  /** The raw hook JSON, exactly as the provider wrote it to stdin. */
  readonly payload: string;
  readonly cwd: string;
  readonly now?: Date;
}

/**
 * Records one normalized observation for one provider hook payload.
 *
 * The payload is untrusted: it is size-limited, parsed as data only, reduced by the provider's
 * adapter to a few metadata fields and then forgotten. Nothing from it is ever executed,
 * interpolated into a command or written verbatim. Returns `true` when something was recorded.
 * It never throws — a telemetry failure must not break the provider session — and writes nothing
 * to stdout.
 */
export async function runHookObserveCommand(input: HookObserveInput): Promise<boolean> {
  try {
    if (input.payload.length > MAX_PAYLOAD_BYTES || !builtInAdapterRegistry.has(input.provider)) {
      return false;
    }

    const adapter = builtInAdapterRegistry.get(input.provider);
    const normalized = adapter.observeHook?.(JSON.parse(input.payload), {
      mcpServers: new Set(builtInMcpServerNames),
      skills: new Set(builtInSkillNames),
    });

    if (normalized === undefined) {
      return false;
    }

    const observation: HarnessObservation = {
      version: OBSERVATION_VERSION,
      timestamp: (input.now ?? new Date()).toISOString(),
      provider: adapter.id,
      session: hashSessionKey(adapter.id, normalized.sessionId),
      event: normalized.event,
      ...(normalized.capabilityKind === undefined
        ? {}
        : { capabilityKind: normalized.capabilityKind }),
      ...(normalized.capability === undefined ? {} : { capability: normalized.capability }),
      ...(normalized.contextTokens === undefined
        ? {}
        : { contextTokens: normalized.contextTokens }),
    };

    return await recordObservation(input.cwd, observation);
  } catch {
    return false;
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    size += chunk.length;

    if (size > MAX_PAYLOAD_BYTES) {
      return "x".repeat(MAX_PAYLOAD_BYTES + 1);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

/**
 * `agentyx hook ...`: commands that provider hooks call. Internal, so hidden from `--help`; the
 * stable surface is `.agentyx.json` and `agentyx doctor`.
 */
export function createHookCommand(): Command {
  return new Command("hook").description("Internal commands called by provider hooks.").addCommand(
    new Command("observe")
      .description("Record local, metadata-only harness activity from a provider hook payload.")
      .requiredOption("--provider <id>", "provider that sent the hook payload")
      .action(async (options: { provider: string }) => {
        await runHookObserveCommand({
          provider: options.provider,
          payload: await readStdin(),
          cwd: process.cwd(),
        });
      }),
  );
}
