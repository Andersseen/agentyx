import { z } from "zod";

export const mcpServerNameSchema = z
  .string()
  .min(1, "MCP server names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'MCP server names must be lowercase kebab-case, for example "context7".',
  );

export const mcpEnvReferenceSchema = z.strictObject({
  fromEnv: z
    .string()
    .trim()
    .min(1, "Environment variable references must be non-empty strings.")
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Environment variable names must be valid shell names."),
});

const commonMcpServerDefinitionSchema = z.strictObject({
  name: mcpServerNameSchema.describe("Unique MCP server identifier."),
  description: z.string().trim().min(1, "MCP server descriptions must be non-empty strings."),
  transport: z.enum(["stdio", "http"]),
});

export const stdioMcpServerDefinitionSchema = commonMcpServerDefinitionSchema.extend({
  transport: z.literal("stdio"),
  command: z.string().trim().min(1, "MCP stdio command must be a non-empty string."),
  args: z.array(z.string()).default([]),
  env: z.record(z.string().min(1), mcpEnvReferenceSchema).default({}),
});

export const httpMcpServerDefinitionSchema = commonMcpServerDefinitionSchema.extend({
  transport: z.literal("http"),
  url: z.url("MCP HTTP URL must be a valid URL."),
  headers: z.record(z.string().min(1), mcpEnvReferenceSchema).default({}),
});

export const mcpServerDefinitionSchema = z.discriminatedUnion("transport", [
  stdioMcpServerDefinitionSchema,
  httpMcpServerDefinitionSchema,
]);

export type McpEnvReference = z.infer<typeof mcpEnvReferenceSchema>;
export type McpServerDefinition = z.infer<typeof mcpServerDefinitionSchema>;
export type McpServerDefinitionInput = z.input<typeof mcpServerDefinitionSchema>;
