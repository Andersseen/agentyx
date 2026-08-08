import { z } from "zod";
import { stackNameSchema } from "../stack/schema.js";

/** How much autonomy the generated environment should grant an agent. */
export const AGNOX_PROFILES = ["lean", "balanced", "autonomous"] as const;

export const agnoxProfileSchema = z.enum(AGNOX_PROFILES, {
  error: `Profile must be one of: ${AGNOX_PROFILES.join(", ")}.`,
});

export type AgnoxProfile = z.infer<typeof agnoxProfileSchema>;

/** Applied when a configuration omits `profile`. */
export const DEFAULT_AGNOX_PROFILE: AgnoxProfile = "balanced";

/**
 * Targets stay free-form strings on purpose: third-party adapters should be
 * able to register providers without a change to this schema.
 */
export const agnoxTargetSchema = z.string().min(1, "Targets must be non-empty strings.");

/** The `.agnox.json` project configuration. */
export const agnoxConfigSchema = z.strictObject({
  $schema: z
    .string()
    .min(1, "$schema must be a non-empty string.")
    .describe("Optional path or URL to the Agnox JSON Schema.")
    .optional(),
  extends: z.array(stackNameSchema).describe("Stacks this project builds on.").default([]),
  profile: agnoxProfileSchema
    .describe("How much autonomy the generated environment grants.")
    .default(DEFAULT_AGNOX_PROFILE),
  targets: z
    .array(agnoxTargetSchema)
    .describe("Coding-agent providers this project targets.")
    .default([]),
});

/** A validated configuration, with defaults applied. */
export type AgnoxConfig = z.infer<typeof agnoxConfigSchema>;

/** The shape accepted in a `.agnox.json` file. */
export type AgnoxConfigInput = z.input<typeof agnoxConfigSchema>;
