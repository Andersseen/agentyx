import { z } from "zod";
import { agentyxConfigSchema } from "./schema.js";

/** Canonical identifier of the published `.agentyx.json` schema. */
export const AGENTYX_CONFIG_SCHEMA_ID =
  "https://raw.githubusercontent.com/Andersseen/agentyx/main/packages/core/schema/agentyx.schema.json";

/**
 * Derives the JSON Schema for `.agentyx.json` from the Zod model, which stays the
 * single source of truth. The committed `schema/agentyx.schema.json` is generated
 * from this function and verified by tests.
 *
 * The `input` view is used so that fields with defaults stay optional, which is
 * what an author writing the file cares about.
 */
export function buildAgentyxConfigJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: AGENTYX_CONFIG_SCHEMA_ID,
    title: "Agentyx project configuration",
    description: "Configuration for an Agentyx project (.agentyx.json).",
    ...z.toJSONSchema(agentyxConfigSchema, { io: "input" }),
  };
}
