import { z } from "zod";
import { stackNameSchema } from "../stack/schema.js";

/** How much autonomy the generated environment should grant an agent. */
export const AGENTYX_PROFILES = ["lean", "balanced", "autonomous"] as const;

export const agentyxProfileSchema = z.enum(AGENTYX_PROFILES, {
  error: `Profile must be one of: ${AGENTYX_PROFILES.join(", ")}.`,
});

export type AgentyxProfile = z.infer<typeof agentyxProfileSchema>;

/** Applied when a configuration omits `profile`. */
export const DEFAULT_AGENTYX_PROFILE: AgentyxProfile = "balanced";

/**
 * Targets stay free-form strings on purpose: third-party adapters should be
 * able to register providers without a change to this schema.
 */
export const agentyxTargetSchema = z.string().min(1, "Targets must be non-empty strings.");

/** The `.agentyx.json` project configuration. */
export const agentyxConfigSchema = z.strictObject({
  $schema: z
    .string()
    .min(1, "$schema must be a non-empty string.")
    .describe("Optional path or URL to the Agentyx JSON Schema.")
    .optional(),
  extends: z.array(stackNameSchema).describe("Stacks this project builds on.").default([]),
  profile: agentyxProfileSchema
    .describe("How much autonomy the generated environment grants.")
    .default(DEFAULT_AGENTYX_PROFILE),
  targets: z
    .array(agentyxTargetSchema)
    .describe("Coding-agent providers this project targets.")
    .default([]),
});

/** A validated configuration, with defaults applied. */
export type AgentyxConfig = z.infer<typeof agentyxConfigSchema>;

/** The shape accepted in a `.agentyx.json` file. */
export type AgentyxConfigInput = z.input<typeof agentyxConfigSchema>;
