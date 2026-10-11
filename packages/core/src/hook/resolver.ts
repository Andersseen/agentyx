import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInHookRegistry } from "./built-in.js";
import { UnknownHookError } from "./errors.js";
import type { HookRegistry } from "./registry.js";
import type { HookReference } from "./schema.js";

export function collectPackHookReferences(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  hookRegistry: HookRegistry,
): HookReference[] {
  const hooks: HookReference[] = [];
  const seen = new Map<string, number>();

  for (const packName of resolvedPacks) {
    for (const hook of packRegistry.get(packName)?.hooks ?? []) {
      const hookName = hook.name;

      const existing = seen.get(hookName);

      if (existing !== undefined) {
        // One capability, many packs: a default contribution wins over an optional one.
        if (hook.activation === "default" && hooks[existing]?.activation === "optional") {
          hooks[existing] = hook;
        }

        continue;
      }

      if (!hookRegistry.has(hookName)) {
        throw new UnknownHookError(hookName, packName, hookRegistry.names);
      }

      seen.set(hookName, hooks.length);
      hooks.push(hook);
    }
  }

  return hooks;
}

export function filterEffectiveHooks(
  hooks: readonly HookReference[],
  enabledCapabilities: readonly string[],
): string[] {
  const enabled = new Set(enabledCapabilities);

  return hooks
    .filter((hook) => hook.activation === "default" || enabled.has(hook.name))
    .map((hook) => hook.name);
}

export function collectPackHooks(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  hookRegistry: HookRegistry,
  enabledCapabilities: readonly string[] = [],
): string[] {
  return filterEffectiveHooks(
    collectPackHookReferences(resolvedPacks, packRegistry, hookRegistry),
    enabledCapabilities,
  );
}

export function resolvePackHookReferences(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  hookRegistry: HookRegistry = builtInHookRegistry,
): HookReference[] {
  return collectPackHookReferences(
    resolvePacks(requestedPacks, packRegistry),
    packRegistry,
    hookRegistry,
  );
}

export function resolvePackHooks(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  hookRegistry: HookRegistry = builtInHookRegistry,
  enabledCapabilities: readonly string[] = [],
): string[] {
  return collectPackHooks(
    resolvePacks(requestedPacks, packRegistry),
    packRegistry,
    hookRegistry,
    enabledCapabilities,
  );
}
