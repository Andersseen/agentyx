import { DuplicateSkillError, InvalidSkillError, UnknownSkillError } from "./errors.js";
import {
  type SkillDefinition,
  type SkillDefinitionInput,
  skillDefinitionSchema,
  skillNameSchema,
} from "./schema.js";

/**
 * Where a single skill comes from. The name is known up front so that listing
 * and existence checks stay cheap, and `load` is only called when something
 * actually needs the instructions — a design that keeps `resolve` working on
 * identifiers alone.
 *
 * This is also the seam an external or remote registry would plug into later.
 */
export interface SkillSource {
  readonly name: string;
  /** Produces the definition. Called at most once per registry. */
  load(): SkillDefinitionInput;
}

/** A name lookup over skills, independent of where the definitions live. */
export interface SkillRegistry {
  /** Registered names in registration order. Never reads a skill body. */
  readonly names: readonly string[];
  has(name: string): boolean;
  /**
   * Loads, validates and caches a skill.
   *
   * @throws {UnknownSkillError} when the name is not registered.
   * @throws {InvalidSkillError} when the source yields an invalid definition.
   */
  get(name: string): SkillDefinition;
}

/**
 * Indexes skill sources by name.
 *
 * Names and duplicates are validated here; the definitions themselves are
 * validated the first time each skill is loaded.
 *
 * @throws {DuplicateSkillError} when two sources share a name.
 * @throws {InvalidSkillError} when a source name is not a valid skill name.
 */
export function createSkillRegistry(sources: Iterable<SkillSource>): SkillRegistry {
  const byName = new Map<string, SkillSource>();

  for (const source of sources) {
    const name = skillNameSchema.safeParse(source.name);

    if (!name.success) {
      throw new InvalidSkillError(`skill source "${source.name}"`, name.error);
    }

    if (byName.has(name.data)) {
      throw new DuplicateSkillError(name.data);
    }

    byName.set(name.data, source);
  }

  const names = [...byName.keys()];
  const loaded = new Map<string, SkillDefinition>();

  return {
    names,
    has: (name) => byName.has(name),
    get: (name) => {
      const cached = loaded.get(name);

      if (cached !== undefined) {
        return cached;
      }

      const source = byName.get(name);

      if (source === undefined) {
        throw new UnknownSkillError(name, undefined, names);
      }

      const origin = `skill "${name}"`;
      const skill = skillDefinitionSchema.safeParse(source.load());

      if (!skill.success) {
        throw new InvalidSkillError(origin, skill.error);
      }

      if (skill.data.name !== name) {
        throw new InvalidSkillError(origin, `it declares the name "${skill.data.name}"`);
      }

      loaded.set(name, skill.data);

      return skill.data;
    },
  };
}
