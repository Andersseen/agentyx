import { z } from "zod";
import { mcpServerReferenceSchema } from "../mcp/schema.js";
import { skillNameSchema } from "../skill/schema.js";
import { toolReferenceSchema } from "../tool/schema.js";

export const PACK_CATEGORIES = [
  "engineering",
  "language",
  "framework",
  "efficiency",
  "workflow",
] as const;

export const packCategorySchema = z.enum(PACK_CATEGORIES);

/**
 * Pack names are plain identifiers. They are intentionally not constrained to
 * a closed list so that external registries can contribute packs later.
 */
export const packNameSchema = z.string().min(1, "Pack names must be non-empty strings.");

/** A pack is a composable provider-neutral capability bundle. */
export const packDefinitionSchema = z.strictObject({
  name: packNameSchema.describe("Unique pack identifier."),
  category: packCategorySchema
    .describe("Discoverability category; does not affect resolution.")
    .default("engineering"),
  description: z
    .string()
    .min(1, "Pack descriptions must be non-empty when provided.")
    .describe("Short human-readable summary of the pack.")
    .optional(),
  skills: z
    .array(skillNameSchema)
    .describe("Skills this pack contributes, in declaration order.")
    .default([]),
  mcpServers: z
    .array(mcpServerReferenceSchema)
    .describe("MCP servers this pack contributes, in declaration order.")
    .default([]),
  tools: z
    .array(toolReferenceSchema)
    .describe("Local tools this pack contributes, in declaration order.")
    .default([]),
});

/** A validated pack definition, with defaults always present. */
export type PackDefinition = z.infer<typeof packDefinitionSchema>;
export type PackCategory = z.infer<typeof packCategorySchema>;

/** The shape accepted when authoring a pack definition. */
export type PackDefinitionInput = z.input<typeof packDefinitionSchema>;
