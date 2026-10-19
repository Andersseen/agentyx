import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { slugify } = await import(pathToFileURL(join(process.cwd(), "src.mjs")));

assert.equal(slugify("Hello World"), "hello-world");
assert.equal(slugify("  Hello   World  "), "hello-world");
