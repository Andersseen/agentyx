import { z } from "zod";
import { skillNameSchema } from "../skill/schema.js";

export const trustedSourceNameSchema = z
  .string()
  .min(1, "Trusted source names must be non-empty strings.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Trusted source names must be lowercase kebab-case, for example "superpowers".',
  );

export const trustedSourcePathSchema = z
  .string()
  .min(1, "Trusted source paths must be non-empty strings.")
  .regex(
    /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\\0]+$/,
    "Trusted source paths must be portable project-relative paths without parent traversal.",
  );

export const trustedSourceReferenceSchema = z.strictObject({
  name: trustedSourceNameSchema.describe("Known trusted source identifier."),
  path: trustedSourcePathSchema.describe("Project-relative checkout path for this source."),
  ref: z
    .string()
    .trim()
    .min(1, "Trusted source refs must be non-empty strings.")
    .describe("Reviewed immutable commit, signed tag or pinned release identifier."),
});

export const trustedSourceDefinitionSchema = z.strictObject({
  name: trustedSourceNameSchema,
  displayName: z.string().min(1),
  repository: z.string().url(),
  type: z.literal("codex-plugin"),
  manifestPath: z.string().min(1),
  recommendedPath: trustedSourcePathSchema,
  description: z.string().min(1),
  installStatus: z.enum(["metadata-only", "installable"]),
  installNote: z.string().min(1),
});

export const codexPluginManifestSchema = z
  .object({
    name: trustedSourceNameSchema,
    version: z.string().min(1),
    description: z.string().min(1),
    repository: z.string().url(),
    license: z.string().min(1),
    skills: z.string().min(1),
  })
  .passthrough();

export const trustedSourceSkillSummarySchema = z.strictObject({
  name: skillNameSchema,
  description: z.string().min(1),
  hasResources: z.boolean(),
});

export type TrustedSourceReference = z.infer<typeof trustedSourceReferenceSchema>;
export type TrustedSourceDefinition = z.infer<typeof trustedSourceDefinitionSchema>;
export type CodexPluginManifest = z.infer<typeof codexPluginManifestSchema>;
export type TrustedSourceSkillSummary = z.infer<typeof trustedSourceSkillSummarySchema>;
