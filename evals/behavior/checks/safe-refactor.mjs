import assert from "node:assert/strict";
import { importFromRun } from "./support.mjs";

const { normalizeTags, summarizeTags } = await importFromRun("src.mjs");

assert.deepEqual(normalizeTags([" Blue ", "blue", null, "RED", ""]), ["blue", "red"]);
assert.equal(summarizeTags([" A ", "B", "a"]), "a, b");
assert.deepEqual(normalizeTags([]), []);
assert.equal(summarizeTags([]), "");
// First occurrence keeps its position; later duplicates are dropped.
assert.deepEqual(normalizeTags(["b", "a", "B", "c", "A"]), ["b", "a", "c"]);
// Only surrounding whitespace is trimmed; inner whitespace is part of the tag.
assert.deepEqual(normalizeTags(["  two  words ", "two words", "\tTab\n"]), [
  "two  words",
  "two words",
  "tab",
]);
// Non-strings are ignored rather than converted.
assert.deepEqual(normalizeTags([1, true, { tag: "x" }, ["y"], undefined, "z"]), ["z"]);
assert.deepEqual(normalizeTags(["   ", "", "\n"]), []);
// The input is not mutated and a new array is returned.
const input = [" X ", "x"];
const output = normalizeTags(input);
assert.deepEqual(input, [" X ", "x"]);
assert.notEqual(output, input);
