import assert from "node:assert/strict";
import { importFromRun } from "./support.mjs";

const { parsePort } = await importFromRun("src.mjs");

// Existing string behavior is preserved.
assert.equal(parsePort("8080"), 8080);
assert.equal(parsePort("1"), 1);
assert.equal(parsePort("65535"), 65535);
assert.equal(parsePort("0080"), 80);
assert.equal(parsePort("0"), null);
assert.equal(parsePort("65536"), null);
assert.equal(parsePort("80x"), null);
assert.equal(parsePort(""), null);
assert.equal(parsePort(" 80"), null);
assert.equal(parsePort("-1"), null);
assert.equal(parsePort("8.5"), null);
// Integer numbers are accepted within range.
assert.equal(parsePort(8080), 8080, "API must accept number or digit string");
assert.equal(parsePort(1), 1);
assert.equal(parsePort(65535), 65535);
// Invalid numbers and other values are rejected.
for (const value of [
  0,
  65536,
  -1,
  80.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  null,
  undefined,
  true,
  {},
  [80],
]) {
  assert.equal(parsePort(value), null, `rejects ${String(value)}`);
}
