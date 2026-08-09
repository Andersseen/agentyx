import { z } from "zod";
import { mcpServerReferenceSchema } from "../mcp/schema.js";
import { skillNameSchema } from "../skill/schema.js";

/**
 * Stack names are plain identifiers. They are intentionally not constrained to
 * a closed list so that external registries can contribute stacks later.
 */
export const stackNameSchema = z.string().min(1, "Stack names must be non-empty strings.");

/**
 * A stack describes a development environment that can build on other stacks
 * and contribute provider-agnostic capabilities to them.
 */
export const stackDefinitionSchema = z.strictObject({
  name: stackNameSchema.describe("Unique stack identifier."),
  description: z
    .string()
    .min(1, "Stack descriptions must be non-empty when provided.")
    .describe("Short human-readable summary of the stack.")
    .optional(),
  extends: z
    .array(stackNameSchema)
    .describe("Stacks this stack builds on, in dependency-first order.")
    .default([]),
  skills: z
    .array(skillNameSchema)
    .describe("Skills this stack contributes, in declaration order.")
    .default([]),
  mcpServers: z
    .array(mcpServerReferenceSchema)
    .describe("MCP servers this stack contributes, in declaration order.")
    .default([]),
});

/** A validated stack definition, with defaults always present. */
export type StackDefinition = z.infer<typeof stackDefinitionSchema>;

/** The shape accepted when authoring a stack definition. */
export type StackDefinitionInput = z.input<typeof stackDefinitionSchema>;
