import {
  type AgentyxConfig,
  builtInAgentRegistry,
  builtInHookRegistry,
  builtInMcpServerRegistry,
  builtInToolRegistry,
  createResolutionSnapshot,
  type PackRegistry,
  type ResolutionDifference,
  type ResolutionSnapshot,
  type ResolvedAgentyxConfig,
  type SkillRegistry,
} from "@agentyx/core";
import { cliVersion } from "./version.js";

export interface CurrentProjectResolution {
  readonly config: AgentyxConfig;
  readonly resolved: ResolvedAgentyxConfig;
  readonly packRegistry: PackRegistry;
  readonly skillRegistry: SkillRegistry;
}

/**
 * The one place the CLI turns an already-resolved project into a `ResolutionSnapshot`: install
 * records it, `doctor --locked` and `install --frozen` compare against it. Core stays free of
 * CLI package metadata, so the exact `cliVersion` and the built-in registries are supplied here.
 */
export function createCurrentProjectResolutionSnapshot(
  project: CurrentProjectResolution,
): ResolutionSnapshot {
  return createResolutionSnapshot({
    agentyxVersion: cliVersion,
    config: project.config,
    resolved: project.resolved,
    packRegistry: project.packRegistry,
    skillRegistry: project.skillRegistry,
    mcpRegistry: builtInMcpServerRegistry,
    toolRegistry: builtInToolRegistry,
    hookRegistry: builtInHookRegistry,
    agentRegistry: builtInAgentRegistry,
  });
}

/** A difference in words only: no hashes, bodies or configuration. */
export function describeDifference(difference: ResolutionDifference): string {
  if (difference.kind === "agentyx-version") {
    return "Agentyx version changed";
  }

  if (difference.kind === "config") {
    return "configuration changed";
  }

  const subject =
    difference.name === undefined ? difference.kind : `${difference.kind} "${difference.name}"`;

  return `${subject} ${difference.change ?? "changed"}`;
}
