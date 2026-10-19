import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { parsePort } = await import(pathToFileURL(join(process.cwd(), "src.mjs")));

assert.equal(parsePort("8080"), 8080);
assert.equal(parsePort(8080), 8080, "API must accept number or digit string");
assert.equal(parsePort("0"), null);
assert.equal(parsePort(65536), null);
assert.equal(parsePort("80x"), null);
