import { builtInPackRegistry, type PackRegistry } from "../pack/registry.js";
import { resolvePacks } from "../pack/resolver.js";
import { builtInSkillRegistry } from "./built-in.js";
import { UnknownSkillError } from "./errors.js";
import type { SkillRegistry } from "./registry.js";

/**
 * Collects the skills contributed by an already-resolved pack chain.
 *
 * Only identifiers are produced — no skill body is read — so this stays cheap
 * enough to run on every `resolve`.
 *
 * @throws {UnknownSkillError} when a pack references a skill the registry lacks.
 */
export function collectPackSkills(
  resolvedPacks: readonly string[],
  packRegistry: PackRegistry,
  skillRegistry: SkillRegistry,
): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  for (const packName of resolvedPacks) {
    for (const skillName of packRegistry.get(packName)?.skills ?? []) {
      if (seen.has(skillName)) {
        continue;
      }

      if (!skillRegistry.has(skillName)) {
        throw new UnknownSkillError(skillName, packName, skillRegistry.names);
      }

      seen.add(skillName);
      skills.push(skillName);
    }
  }

  return skills;
}

/**
 * Resolves the requested packs and returns the skills they contribute.
 *
 * The result follows the resolved pack order, then each pack's declaration
 * order, and is de-duplicated by first occurrence. Skills do not extend other
 * skills, so there is nothing further to expand.
 *
 * @throws {UnknownPackError} when a requested pack is missing.
 * @throws {UnknownSkillError} when a pack references a skill the registry lacks.
 */
export function resolvePackSkills(
  requestedPacks: readonly string[],
  packRegistry: PackRegistry = builtInPackRegistry,
  skillRegistry: SkillRegistry = builtInSkillRegistry,
): string[] {
  return collectPackSkills(resolvePacks(requestedPacks, packRegistry), packRegistry, skillRegistry);
}
