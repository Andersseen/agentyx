import { z } from "zod";

export const HOOK_ACTIVATION_LEVELS = ["default", "optional"] as const;

export const hookActivationLevelSchema = z.enum(HOOK_ACTIVATION_LEVELS);

export const HOOK_EVENTS = ["SessionStart"] as const;

export const hookEventSchema = z.enum(HOOK_EVENTS);

export const hookNameSchema = z
  .string()
  .min(1, "Hook names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Hook names must be lowercase kebab-case, for example "session-doctor-bootstrap".',
  );

export const hookDefinitionSchema = z.strictObject({
  name: hookNameSchema.describe("Unique hook identifier."),
  description: z.string().trim().min(1, "Hook descriptions must be non-empty strings."),
  event: hookEventSchema.describe("The provider lifecycle event this hook runs on."),
  command: z.string().trim().min(1, "Hook command must be a non-empty string."),
  args: z.array(z.string()).default([]),
});

export const hookReferenceSchema = z
  .union([
    hookNameSchema,
    z.strictObject({
      name: hookNameSchema.describe("Hook identifier."),
      activation: hookActivationLevelSchema.default("default"),
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
      name: hookNameSchema.describe("Hook identifier."),
      activation: hookActivationLevelSchema.describe(
        "Whether this hook is active by default or explicit opt-in.",
      ),
    }),
  );

export type HookActivationLevel = z.infer<typeof hookActivationLevelSchema>;
export type HookEvent = z.infer<typeof hookEventSchema>;
export type HookDefinition = z.infer<typeof hookDefinitionSchema>;
export type HookDefinitionInput = z.input<typeof hookDefinitionSchema>;
export type HookReference = z.infer<typeof hookReferenceSchema>;
export type HookReferenceInput = z.input<typeof hookReferenceSchema>;
