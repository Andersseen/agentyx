import { z } from "zod";
import { agnoxConfigSchema } from "./schema.js";

/** Canonical identifier of the published `.agnox.json` schema. */
export const AGNOX_CONFIG_SCHEMA_ID = "https://agnox.dev/schema/agnox.schema.json";

/**
 * Derives the JSON Schema for `.agnox.json` from the Zod model, which stays the
 * single source of truth. The committed `schema/agnox.schema.json` is generated
 * from this function and verified by tests.
 *
 * The `input` view is used so that fields with defaults stay optional, which is
 * what an author writing the file cares about.
 */
export function buildAgnoxConfigJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: AGNOX_CONFIG_SCHEMA_ID,
    title: "Agnox project configuration",
    description: "Configuration for an Agnox project (.agnox.json).",
    ...z.toJSONSchema(agnoxConfigSchema, { io: "input" }),
  };
}
