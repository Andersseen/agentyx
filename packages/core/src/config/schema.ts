import { z } from "zod";
import { packNameSchema } from "../pack/schema.js";

/**
 * Targets stay free-form strings on purpose: third-party adapters should be
 * able to register providers without a change to this schema.
 */
export const agentyxTargetSchema = z.string().min(1, "Targets must be non-empty strings.");

export const enabledCapabilityNameSchema = z
  .string()
  .min(1, "Enabled capability names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Enabled capability names must be lowercase kebab-case, for example "rtk".',
  );

/** The `.agentyx.json` project configuration. */
export const agentyxConfigSchema = z.strictObject({
  $schema: z
    .string()
    .min(1, "$schema must be a non-empty string.")
    .describe("Optional path or URL to the Agentyx JSON Schema.")
    .optional(),
  packs: z.array(packNameSchema).describe("Capability packs this project selects.").default([]),
  enable: z
    .array(enabledCapabilityNameSchema)
    .describe("Optional capabilities to activate by explicit identifier.")
    .default([]),
  targets: z
    .array(agentyxTargetSchema)
    .describe("Coding-agent providers this project targets.")
    .default([]),
});

/** A validated configuration, with defaults applied. */
export type AgentyxConfig = z.infer<typeof agentyxConfigSchema>;

/** The shape accepted in a `.agentyx.json` file. */
export type AgentyxConfigInput = z.input<typeof agentyxConfigSchema>;
