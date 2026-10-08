import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  AGENTYX_MANIFEST_FILENAME,
  builtInMcpServerNames,
  builtInSkillNames,
  type HarnessObservation,
  hashSessionKey,
  loadInstallManifest,
  OBSERVATION_VERSION,
  recordObservation,
} from "@agentyx/core";
import { Command } from "commander";
import { installedHarnessBaseline } from "./harness-baseline.js";

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
      // Only a session start pays for reading the manifest; every other event stays a bare append.
      ...(normalized.event === "session-start" ? await baselineField(input.cwd) : {}),
    };

    return await recordObservation(input.cwd, observation);
  } catch {
    return false;
  }
}

/**
 * The baseline of the harness that is INSTALLED, which is what the running provider's hooks belong
 * to — not `.agentyx.json`, which may be ahead of it. Anything uncertain (no manifest, a damaged
 * one, no installed capability) yields no baseline, and a session without one is never negative
 * evidence. Reads one small file; scans nothing.
 */
async function baselineField(cwd: string): Promise<{ baseline?: string }> {
  try {
    for (let dir = resolve(cwd); ; dir = dirname(dir)) {
      const found = await stat(join(dir, AGENTYX_MANIFEST_FILENAME)).then(
        (info) => info.isFile(),
        () => false,
      );

      if (found) {
        const baseline = installedHarnessBaseline(await loadInstallManifest(dir));

        return baseline === undefined ? {} : { baseline: baseline.fingerprint };
      }

      if (dirname(dir) === dir) {
        return {};
      }
    }
  } catch {
    return {};
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
