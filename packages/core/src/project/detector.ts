import type { AgentyxConfigInput } from "../config/schema.js";
import { collectProjectSignals, type ProjectSignals } from "./signals.js";

export type {
  PackageManagerDetection,
  PackageManagerName,
  ProjectPackageJsonDetection,
} from "./signals.js";
export { PACKAGE_MANAGERS } from "./signals.js";

export interface ProjectDetection {
  readonly projectDir: string;
  readonly packageJson: ProjectSignals["packageJson"];
  readonly packageManager: ProjectSignals["packageManager"];
  /** The richer, provider-neutral facts `recommendCapabilities` (`./recommend.js`) turns into suggestions. */
  readonly signals: ProjectSignals;
}

/**
 * Factual project detection only. It gathers `ProjectSignals` and never decides which packs or
 * capabilities fit — that policy lives in `recommendCapabilities`, kept separate so each half stays
 * independently testable.
 */
export async function detectProject(projectDir: string): Promise<ProjectDetection> {
  const signals = await collectProjectSignals(projectDir);

  return {
    projectDir,
    packageJson: signals.packageJson,
    packageManager: signals.packageManager,
    signals,
  };
}

export function buildAgentyxConfig(input: {
  readonly packs: readonly string[];
  readonly enable?: readonly string[];
  readonly targets: readonly string[];
}): AgentyxConfigInput {
  return {
    packs: [...input.packs],
    enable: [...(input.enable ?? [])],
    targets: [...input.targets],
  };
}

export function formatAgentyxConfig(config: AgentyxConfigInput): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
