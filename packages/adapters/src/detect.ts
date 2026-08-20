import { builtInAdapterRegistry } from "./built-in.js";
import type { AdapterRegistry } from "./registry.js";

/**
 * The targets whose provider is already used in this project, in registration
 * order.
 *
 * This exists so `init` can propose the agents a developer actually has instead
 * of a hard-coded pair. It is a *suggestion* and nothing else: Agentyx still
 * writes only the targets that end up in `.agentyx.json`, and an empty result
 * simply means the user is asked without a pre-selection.
 *
 * Reads the filesystem; never writes.
 */
export async function detectConfiguredTargets(
  projectDir: string,
  registry: AdapterRegistry = builtInAdapterRegistry,
): Promise<readonly string[]> {
  const detections = await Promise.all(
    registry.list().map((adapter) => adapter.detect(projectDir)),
  );

  return detections
    .filter((detection) => detection.configured)
    .map((detection) => detection.target);
}
