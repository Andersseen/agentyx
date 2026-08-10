import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AGENTYX_CONFIG_SCHEMA_ID,
  buildAgentyxConfigJsonSchema,
} from "../src/config/json-schema.js";

const committedSchemaPath = fileURLToPath(
  new URL("../schema/agentyx.schema.json", import.meta.url),
);

describe("buildAgentyxConfigJsonSchema", () => {
  it("describes the configuration fields", () => {
    const schema = buildAgentyxConfigJsonSchema();

    expect(schema.$id).toBe(AGENTYX_CONFIG_SCHEMA_ID);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties as Record<string, unknown>)).toEqual([
      "$schema",
      "packs",
      "enable",
      "targets",
    ]);
  });

  it("keeps defaulted fields optional for authors", () => {
    expect(buildAgentyxConfigJsonSchema().required).toBeUndefined();
  });

  it("describes enabled capability names", () => {
    const properties = buildAgentyxConfigJsonSchema().properties as Record<
      string,
      { items?: { pattern?: string } }
    >;

    expect(properties.enable?.items?.pattern).toBe("^[a-z0-9]+(?:-[a-z0-9]+)*$");
  });

  it("is deterministic", () => {
    expect(JSON.stringify(buildAgentyxConfigJsonSchema())).toBe(
      JSON.stringify(buildAgentyxConfigJsonSchema()),
    );
  });

  it("matches the committed schema file", async () => {
    const committed = JSON.parse(await readFile(committedSchemaPath, "utf8"));

    expect(committed).toEqual(buildAgentyxConfigJsonSchema());
  });
});
