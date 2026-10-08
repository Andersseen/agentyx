import { createHash } from "node:crypto";
import type { InstallManifest } from "../manifest/schema.js";

/**
 * Version of what "observable" means. Bump it when a provider's observability semantics change (for
 * example Codex gaining reliable Skill-use hooks) so sessions recorded under the old semantics can
 * never count as negative evidence for the new ones. Deliberately NOT the package version: an
 * upgrade that does not change observation semantics must not reset utilization.
 */
export const HARNESS_OBSERVATION_CONTRACT_VERSION = 1;

/** A capability that is part of the harness a provider is running. */
export interface BaselineCapability {
  readonly kind: "skill" | "mcp" | "hook";
  readonly name: string;
  readonly target: string;
}

/** The normalized observability contract of one provider; see the adapter's `observability`. */
export interface BaselineProvider {
  readonly id: string;
  readonly projectHooks: boolean;
  readonly sessionLifecycle: boolean;
  readonly toolUse: boolean;
  readonly skillUse: boolean;
  readonly mcpUse: boolean;
  readonly contextTokens: boolean;
}

export interface HarnessBaselineInput {
  readonly capabilities: readonly BaselineCapability[];
  readonly providers: readonly BaselineProvider[];
}

export interface HarnessBaseline {
  readonly version: number;
  /** Opaque, deterministic, 16 lowercase hex characters. */
  readonly fingerprint: string;
}

/**
 * The capabilities a manifest says are installed, per target.
 *
 * The manifest is the record of what the provider is actually running, which `.agentyx.json` (the
 * desired state) is not until `agentyx install` has run. Tools are not installed by Agentyx and can
 * never be ruled out, so they play no part in the baseline.
 */
export function installedCapabilities(manifest: InstallManifest): BaselineCapability[] {
  return manifest.entries.flatMap((entry): BaselineCapability[] => {
    const names =
      entry.kind === "skill" ? [entry.skill] : entry.kind === "mcp" ? entry.servers : entry.hooks;

    return entry.targets.flatMap((target) =>
      names.map((name) => ({ kind: entry.kind, name, target })),
    );
  });
}

/**
 * The identifier of the harness state that sessions are recorded under.
 *
 * Pure and deterministic: unordered inputs are sorted and deduplicated, and only Agentyx capability
 * names, target ids and provider observability flags are hashed — never paths, environment values,
 * timestamps, provider session ids or any project content. Two equivalent harnesses give the same
 * fingerprint; any change to capabilities, targets or observability gives a different one, which
 * begins a new baseline.
 */
export function computeHarnessObservationBaseline(input: HarnessBaselineInput): HarnessBaseline {
  const canonical = {
    contract: HARNESS_OBSERVATION_CONTRACT_VERSION,
    capabilities: unique(
      input.capabilities.map(
        (capability) => `${capability.kind}:${capability.name}@${capability.target}`,
      ),
    ),
    providers: unique(
      input.providers.map((provider) =>
        [
          provider.id,
          provider.projectHooks,
          provider.sessionLifecycle,
          provider.toolUse,
          provider.skillUse,
          provider.mcpUse,
          provider.contextTokens,
        ].join(":"),
      ),
    ),
  };

  return {
    version: HARNESS_OBSERVATION_CONTRACT_VERSION,
    fingerprint: createHash("sha256")
      .update(`agentyx-baseline\0${JSON.stringify(canonical)}`)
      .digest("hex")
      .slice(0, 16),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
