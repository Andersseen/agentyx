import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AGNOX_CONFIG_SCHEMA_ID, buildAgnoxConfigJsonSchema } from "../src/config/json-schema.js";

const committedSchemaPath = fileURLToPath(new URL("../schema/agnox.schema.json", import.meta.url));

describe("buildAgnoxConfigJsonSchema", () => {
  it("describes the configuration fields", () => {
    const schema = buildAgnoxConfigJsonSchema();

    expect(schema.$id).toBe(AGNOX_CONFIG_SCHEMA_ID);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties as Record<string, unknown>)).toEqual([
      "$schema",
      "extends",
      "profile",
      "targets",
    ]);
  });

  it("keeps defaulted fields optional for authors", () => {
    expect(buildAgnoxConfigJsonSchema().required).toBeUndefined();
  });

  it("enumerates the profiles", () => {
    const properties = buildAgnoxConfigJsonSchema().properties as Record<
      string,
      { enum?: string[] }
    >;

    expect(properties.profile?.enum).toEqual(["lean", "balanced", "autonomous"]);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(buildAgnoxConfigJsonSchema())).toBe(
      JSON.stringify(buildAgnoxConfigJsonSchema()),
    );
  });

  it("matches the committed schema file", async () => {
    const committed = JSON.parse(await readFile(committedSchemaPath, "utf8"));

    expect(committed).toEqual(buildAgnoxConfigJsonSchema());
  });
});
