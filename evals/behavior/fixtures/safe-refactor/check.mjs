import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { normalizeTags, summarizeTags } = await import(
  pathToFileURL(join(process.cwd(), "src.mjs"))
);

assert.deepEqual(normalizeTags([" Blue ", "blue", null, "RED", ""]), ["blue", "red"]);
assert.equal(summarizeTags([" A ", "B", "a"]), "a, b");
assert.deepEqual(normalizeTags([]), []);
