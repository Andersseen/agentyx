import assert from "node:assert/strict";
import { normalizeTags, summarizeTags } from "./src.mjs";

assert.deepEqual(normalizeTags([" Blue ", "blue", null, "RED", ""]), ["blue", "red"]);
assert.equal(summarizeTags([" A ", "B", "a"]), "a, b");
assert.deepEqual(normalizeTags([]), []);
console.log("tag tests passed");
