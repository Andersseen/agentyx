import assert from "node:assert/strict";
import { importFromRun } from "./support.mjs";

const { slugify } = await importFromRun("src.mjs");

assert.equal(slugify("Hello World"), "hello-world");
assert.equal(slugify("  Hello   World  "), "hello-world");
