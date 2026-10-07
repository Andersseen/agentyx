import { z } from "zod";
import { packDefinitionSchema, packNameSchema } from "../pack/schema.js";
import { trustedSourceReferenceSchema } from "../source/schema.js";

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

/**
 * Portable project-relative path to a directory whose direct children are Agent Skills.
 * Backslashes, absolute paths and parent traversal are rejected so the same config is safe on
 * every supported platform.
 */
export const skillDirectorySchema = z
  .string()
  .min(1, "Skill directories must be non-empty strings.")
  .regex(
    /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\\0]+$/,
    "Skill directories must be portable project-relative paths without parent traversal.",
  );

const projectIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Project ids must be lowercase kebab-case identifiers.");
const projectTextSchema = z
  .string()
  .min(1, "Must not be blank.")
  .refine((value) => value.trim().length > 0, "Must not be blank.")
  .refine(
    (value) =>
      Array.from(value).every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 31 && (codePoint < 127 || codePoint > 159);
      }),
    "Must be single-line text without control characters.",
  );
const projectUrlSchema = z.string().url("Must be a valid URL.");
const projectResourceNames = z
  .array(projectTextSchema)
  .refine((items) => new Set(items).size === items.length, "Entries must be unique.");
const projectDocsSchema = z
  .array(projectUrlSchema)
  .refine((items) => new Set(items).size === items.length, "Documentation URLs must be unique.");
const projectOwnsSchema = z
  .array(projectIdSchema)
  .refine((items) => new Set(items).size === items.length, "Ownership entries must be unique.");

export const projectMetadataSchema = z.strictObject({
  id: projectIdSchema.describe("Stable, human-authored project identifier in kebab-case."),
  name: projectTextSchema.describe("Human-readable project name."),
  description: projectTextSchema.optional().describe("Short description of this project."),
  repository: projectUrlSchema
    .optional()
    .describe("Repository URL; descriptive and never fetched."),
  docs: projectDocsSchema.default([]).describe("Documentation URLs; descriptive only."),
  mcp: projectResourceNames.default([]).describe("MCP server identifiers available to consult."),
  owns: projectOwnsSchema.default([]).describe("Architectural capabilities owned by this project."),
});

export const projectRelationTypeSchema = z.enum(["uses", "integrates", "consumes", "extends"]);

export const projectRelationSchema = z.strictObject({
  id: projectIdSchema.describe("Stable identifier for the related project."),
  name: projectTextSchema.describe("Human-readable related project name."),
  type: projectRelationTypeSchema.describe("How the current project relates to this project."),
  role: projectIdSchema.describe("Architectural role of the related project."),
  repository: projectUrlSchema
    .optional()
    .describe("Repository URL; descriptive and never fetched."),
  docs: projectDocsSchema.default([]).describe("Documentation URLs; descriptive only."),
  mcp: projectResourceNames.default([]).describe("MCP server identifiers available to consult."),
  owns: projectOwnsSchema.default([]).describe("Architectural capabilities owned by this project."),
  guidance: z.array(projectTextSchema).default([]).describe("Human-authored guidance for agents."),
});

export const projectCommandSchema = z.strictObject({
  command: projectTextSchema.describe("Suggested command; Agentyx never executes it."),
  cwd: z.string().min(1).default(".").describe("Project-relative working directory."),
});

export const projectContextSchema = z
  .strictObject({
    commands: z
      .record(
        z
          .string()
          .min(1)
          .refine((name) => name.trim().length > 0, "Command names must not be blank."),
        projectCommandSchema,
      )
      .default({}),
    areas: z
      .array(
        z.strictObject({
          path: z.string().min(1),
          purpose: projectTextSchema,
        }),
      )
      .default([]),
    constraints: z.array(projectTextSchema).default([]),
  })
  .describe("Explicit repository-local facts for the generated project context Skill.");

/** The `.agentyx.json` project configuration. */
export const agentyxConfigSchema = z
  .strictObject({
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
    skillDirectories: z
      .array(skillDirectorySchema)
      .describe("Project-relative roots containing local Agent Skills.")
      .optional(),
    localPacks: z
      .array(packDefinitionSchema)
      .describe("Project-owned packs that can reference built-in or local Skills.")
      .optional(),
    trustedSources: z
      .array(trustedSourceReferenceSchema)
      .describe("Pinned local checkouts of known external skill/plugin sources.")
      .optional(),
    project: projectMetadataSchema.optional().describe("Identity and ownership for this project."),
    relations: z
      .array(projectRelationSchema)
      .optional()
      .describe("Direct architectural relationships."),
    context: projectContextSchema.optional(),
  })
  .superRefine((config, context) => {
    const relations = config.relations ?? [];
    if (relations.length > 0 && config.project === undefined) {
      context.addIssue({
        code: "custom",
        path: ["project"],
        message: "Project metadata is required when relations are configured.",
      });
    }
    const ids = new Set<string>();
    for (const [index, relation] of relations.entries()) {
      if (config.project?.id === relation.id) {
        context.addIssue({
          code: "custom",
          path: ["relations", index, "id"],
          message: "A project cannot relate to itself.",
        });
      }
      if (ids.has(relation.id)) {
        context.addIssue({
          code: "custom",
          path: ["relations", index, "id"],
          message: "Related project ids must be unique.",
        });
      }
      ids.add(relation.id);
    }
    const areaPaths = config.context?.areas.map((area) => area.path) ?? [];
    if (new Set(areaPaths).size !== areaPaths.length) {
      context.addIssue({
        code: "custom",
        path: ["context", "areas"],
        message: "Area paths must be unique.",
      });
    }
  });

/** A validated configuration, with defaults applied. */
export type AgentyxConfig = z.infer<typeof agentyxConfigSchema>;

/** The shape accepted in a `.agentyx.json` file. */
export type AgentyxConfigInput = z.input<typeof agentyxConfigSchema>;
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;
export type ProjectRelation = z.infer<typeof projectRelationSchema>;
export type ProjectContext = z.infer<typeof projectContextSchema>;
