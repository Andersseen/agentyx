import { z } from "zod";

/**
 * The manifest format version.
 *
 * A manifest written by a newer Agentyx fails validation instead of being
 * reinterpreted, because acting on a half-understood record of managed files is
 * how an installer deletes something it should not.
 */
export const INSTALL_MANIFEST_VERSION = 1;

/**
 * A path Agentyx manages, relative to the project root and always written with
 * `/` separators so a manifest reads the same on every platform.
 */
export const managedPathSchema = z
  .string()
  .min(1, "Managed paths must be non-empty strings.")
  .refine((value) => !value.startsWith("/"), "Managed paths must be relative to the project root.")
  .refine((value) => !value.includes("\\"), "Managed paths must use `/` separators.")
  .refine(
    (value) => !value.split("/").includes(".."),
    "Managed paths must not traverse outside the project root.",
  );

/** A SHA-256 digest of the exact bytes Agentyx last wrote to a managed path. */
export const contentHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Content hashes must be lowercase hexadecimal SHA-256 digests.");

const targetsSchema = z
  .array(z.string().min(1, "Targets must be non-empty strings."))
  .min(1, "A manifest entry must record at least one target.");

/** A `SKILL.md` file Agentyx wrote, owned entirely by Agentyx. */
export const skillManifestEntrySchema = z.strictObject({
  kind: z.literal("skill"),
  path: managedPathSchema,
  skill: z.string().min(1, "Skill names must be non-empty strings."),
  targets: targetsSchema,
  hash: contentHashSchema,
});

/**
 * A provider MCP configuration file Agentyx contributed entries to.
 *
 * Unlike a skill file this one is shared with the user, so the entry records
 * the server keys Agentyx added rather than claiming the whole document.
 * `created` says whether the file existed before Agentyx first wrote it, which
 * is the only thing that makes removing the file itself safe.
 */
export const mcpManifestEntrySchema = z.strictObject({
  kind: z.literal("mcp"),
  path: managedPathSchema,
  servers: z.array(z.string().min(1, "MCP server names must be non-empty strings.")),
  targets: targetsSchema,
  hash: contentHashSchema,
  created: z.boolean(),
});

export const installManifestEntrySchema = z.discriminatedUnion("kind", [
  skillManifestEntrySchema,
  mcpManifestEntrySchema,
]);

/** The `.agentyx.lock.json` record of everything Agentyx installed into a project. */
export const installManifestSchema = z.strictObject({
  version: z.literal(INSTALL_MANIFEST_VERSION),
  entries: z.array(installManifestEntrySchema).default([]),
});

export type SkillManifestEntry = z.infer<typeof skillManifestEntrySchema>;
export type McpManifestEntry = z.infer<typeof mcpManifestEntrySchema>;
export type InstallManifestEntry = z.infer<typeof installManifestEntrySchema>;

/** A validated manifest, with defaults applied. */
export type InstallManifest = z.infer<typeof installManifestSchema>;

/** The shape accepted in a `.agentyx.lock.json` file. */
export type InstallManifestInput = z.input<typeof installManifestSchema>;
