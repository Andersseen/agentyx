import { z } from "zod";

/**
 * Skill names double as directory names for `SKILL.md` files, so they are
 * constrained to a lowercase slug. That keeps them stable across filesystems
 * and makes them safe to join onto a path.
 */
export const skillNameSchema = z
  .string()
  .min(1, "Skill names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Skill names must be lowercase kebab-case, for example "typescript-modern".',
  );

/**
 * The metadata a Skill carries, and exactly what a `SKILL.md` frontmatter block
 * may declare. Kept separate from the full definition so the parser can reject
 * a frontmatter key that tries to supply the body.
 */
export const skillMetadataSchema = z.strictObject({
  name: skillNameSchema.describe("Unique skill identifier."),
  description: z
    .string()
    .trim()
    .min(1, "Skill descriptions must be non-empty strings.")
    .describe("One-line summary of what the skill tells an agent to do."),
});

/**
 * A Skill is reusable instruction text for a coding agent. It is deliberately
 * provider-independent: nothing here says how or where a provider installs it.
 */
export const skillDefinitionSchema = skillMetadataSchema.extend({
  content: z
    .string()
    .trim()
    .min(1, "Skill content must be non-empty.")
    .describe("The Markdown instructions handed to an agent."),
});

/** A validated skill definition. */
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

/** The shape accepted when authoring a skill definition. */
export type SkillDefinitionInput = z.input<typeof skillDefinitionSchema>;
