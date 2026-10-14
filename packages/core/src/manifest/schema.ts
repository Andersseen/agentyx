import { z } from "zod";
import { contentHashSchema } from "./hashing.js";
import { resolutionSnapshotSchema } from "./resolution.js";

/**
 * The manifest format version.
 *
 * A manifest written by a newer Agentyx fails validation instead of being
 * reinterpreted, because acting on a half-understood record of managed files is
 * how an installer deletes something it should not.
 */
/** The ownership-only manifest version currently written by normal installs. */
export const INSTALL_MANIFEST_V1_VERSION = 1;
/** The newest manifest version understood by core; R090-02 will make it the normal writer. */
export const INSTALL_MANIFEST_V2_VERSION = 2;
/** @deprecated Use `INSTALL_MANIFEST_V1_VERSION` for the current writer explicitly. */
export const INSTALL_MANIFEST_VERSION = INSTALL_MANIFEST_V1_VERSION;

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
export const agentManifestEntrySchema = z.strictObject({
  kind: z.literal("agent"),
  path: managedPathSchema,
  agent: z.string().min(1),
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

/**
 * A provider hook configuration file Agentyx contributed entries to.
 *
 * Shares the `mcp` entry's shape and rationale: the file is shared with the
 * user, so the entry records the hook names Agentyx added rather than
 * claiming the whole document.
 */
export const hookManifestEntrySchema = z.strictObject({
  kind: z.literal("hook"),
  path: managedPathSchema,
  hooks: z.array(z.string().min(1, "Hook names must be non-empty strings.")),
  targets: targetsSchema,
  hash: contentHashSchema,
  created: z.boolean(),
});

export const installManifestEntrySchema = z.discriminatedUnion("kind", [
  skillManifestEntrySchema,
  agentManifestEntrySchema,
  mcpManifestEntrySchema,
  hookManifestEntrySchema,
]);

/** The `.agentyx.lock.json` record of everything Agentyx installed into a project. */
export const installManifestV1Schema = z.strictObject({
  version: z.literal(INSTALL_MANIFEST_V1_VERSION),
  entries: z.array(installManifestEntrySchema).default([]),
});

export const installManifestV2Schema = z.strictObject({
  version: z.literal(INSTALL_MANIFEST_V2_VERSION),
  entries: z.array(installManifestEntrySchema).default([]),
  resolution: resolutionSnapshotSchema.nullable(),
});

export const installManifestSchema = z.discriminatedUnion("version", [
  installManifestV1Schema,
  installManifestV2Schema,
]);

export type SkillManifestEntry = z.infer<typeof skillManifestEntrySchema>;
export type AgentManifestEntry = z.infer<typeof agentManifestEntrySchema>;
export type McpManifestEntry = z.infer<typeof mcpManifestEntrySchema>;
export type HookManifestEntry = z.infer<typeof hookManifestEntrySchema>;
export type InstallManifestEntry = z.infer<typeof installManifestEntrySchema>;

export type InstallManifestV1 = z.infer<typeof installManifestV1Schema>;
export type InstallManifestV2 = z.infer<typeof installManifestV2Schema>;

/** A validated manifest, with defaults applied. */
export type InstallManifest = z.infer<typeof installManifestSchema>;

/** The shape accepted in a `.agentyx.lock.json` file. */
export type InstallManifestInput = z.input<typeof installManifestSchema>;
