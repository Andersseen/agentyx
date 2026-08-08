import { builtInStackRegistry, type StackRegistry } from "../stack/registry.js";
import { resolveStacks } from "../stack/resolver.js";
import { builtInSkillRegistry } from "./built-in.js";
import { UnknownSkillError } from "./errors.js";
import type { SkillRegistry } from "./registry.js";

/**
 * Collects the skills contributed by an already-resolved stack chain.
 *
 * Only identifiers are produced — no skill body is read — so this stays cheap
 * enough to run on every `resolve`.
 *
 * @throws {UnknownSkillError} when a stack references a skill the registry lacks.
 */
export function collectStackSkills(
  resolvedStacks: readonly string[],
  stackRegistry: StackRegistry,
  skillRegistry: SkillRegistry,
): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  for (const stackName of resolvedStacks) {
    for (const skillName of stackRegistry.get(stackName)?.skills ?? []) {
      if (seen.has(skillName)) {
        continue;
      }

      if (!skillRegistry.has(skillName)) {
        throw new UnknownSkillError(skillName, stackName, skillRegistry.names);
      }

      seen.add(skillName);
      skills.push(skillName);
    }
  }

  return skills;
}

/**
 * Expands the requested stacks and returns the skills they contribute.
 *
 * The result follows the resolved stack order, then each stack's declaration
 * order, and is de-duplicated by first occurrence. Skills do not extend other
 * skills, so there is nothing further to expand.
 *
 * @throws {UnknownStackError} when a requested or inherited stack is missing.
 * @throws {CircularStackDependencyError} when stack inheritance forms a cycle.
 * @throws {UnknownSkillError} when a stack references a skill the registry lacks.
 */
export function resolveStackSkills(
  requestedStacks: readonly string[],
  stackRegistry: StackRegistry = builtInStackRegistry,
  skillRegistry: SkillRegistry = builtInSkillRegistry,
): string[] {
  return collectStackSkills(
    resolveStacks(requestedStacks, stackRegistry),
    stackRegistry,
    skillRegistry,
  );
}
