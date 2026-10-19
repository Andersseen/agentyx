import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { formatLabel } = await import(pathToFileURL(join(process.cwd(), "src.mjs")));

assert.equal(formatLabel("  Sample  "), "Sample");
assert.equal(formatLabel(12), "12");
