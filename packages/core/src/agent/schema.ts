import { z } from "zod";

export const agentNameSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const agentAccessSchema = z.enum(["read-only", "workspace-write"]);
export const agentDefinitionSchema = z.strictObject({
  name: agentNameSchema,
  description: z.string().trim().min(1),
  instructions: z.string().trim().min(1),
  access: agentAccessSchema,
});
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;
export type AgentDefinitionInput = z.input<typeof agentDefinitionSchema>;
export type AgentAccess = z.infer<typeof agentAccessSchema>;
export const agentReferenceSchema = z.strictObject({
  name: agentNameSchema,
  activation: z.enum(["default", "optional"]).default("default"),
});
export type AgentReference = z.infer<typeof agentReferenceSchema>;
export type AgentReferenceInput = z.input<typeof agentReferenceSchema>;
