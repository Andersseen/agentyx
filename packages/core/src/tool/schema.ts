import { z } from "zod";

export const TOOL_ACTIVATION_LEVELS = ["default", "optional"] as const;

export const toolActivationLevelSchema = z.enum(TOOL_ACTIVATION_LEVELS);

export const toolNameSchema = z
  .string()
  .min(1, "Tool names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Tool names must be lowercase kebab-case, for example "rtk".',
  );

export const toolReferenceSchema = z
  .union([
    toolNameSchema,
    z.strictObject({
      name: toolNameSchema.describe("Tool identifier."),
      activation: toolActivationLevelSchema.default("default"),
    }),
  ])
  .transform((value) =>
    typeof value === "string"
      ? {
          name: value,
          activation: "default" as const,
        }
      : value,
  )
  .pipe(
    z.strictObject({
      name: toolNameSchema.describe("Tool identifier."),
      activation: toolActivationLevelSchema,
    }),
  );

export const toolDefinitionSchema = z.strictObject({
  name: toolNameSchema.describe("Unique tool identifier."),
  description: z.string().trim().min(1, "Tool descriptions must be non-empty strings."),
  kind: z.literal("executable"),
  command: z.string().trim().min(1, "Tool executable command must be a non-empty string."),
  optional: z.boolean().default(true),
  installHint: z.string().trim().min(1, "Tool install hints must be non-empty strings.").optional(),
});

export type ToolActivationLevel = z.infer<typeof toolActivationLevelSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ToolDefinitionInput = z.input<typeof toolDefinitionSchema>;
export type ToolReference = z.infer<typeof toolReferenceSchema>;
export type ToolReferenceInput = z.input<typeof toolReferenceSchema>;
