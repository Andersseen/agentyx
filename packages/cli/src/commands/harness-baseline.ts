import { builtInAdapterRegistry } from "@agentyx/adapters";
import {
  type BaselineProvider,
  computeHarnessObservationBaseline,
  type HarnessBaseline,
  type InstallManifest,
  installedCapabilities,
} from "@agentyx/core";

/**
 * The baseline of the harness a manifest says is installed, or `undefined` when nothing is.
 *
 * Provider observability comes from the adapters, normalized into plain flags, so core never sees a
 * provider id it needs to branch on.
 */
export function installedHarnessBaseline(manifest: InstallManifest): HarnessBaseline | undefined {
  const capabilities = installedCapabilities(manifest);

  if (capabilities.length === 0) {
    return undefined;
  }

  const providers: BaselineProvider[] = [...new Set(capabilities.map(({ target }) => target))]
    .filter((target) => builtInAdapterRegistry.has(target))
    .map((target) => {
      const observability = builtInAdapterRegistry.get(target).capabilities.observability;

      return {
        id: target,
        projectHooks: observability?.projectHooks === true,
        sessionLifecycle: observability?.sessionLifecycle === true,
        toolUse: observability?.toolUse === true,
        skillUse: observability?.skillUse === true,
        mcpUse: observability?.mcpUse === true,
        contextTokens: observability?.contextTokens === true,
      };
    });

  return computeHarnessObservationBaseline({ capabilities, providers });
}
