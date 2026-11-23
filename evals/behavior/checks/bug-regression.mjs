import assert from "node:assert/strict";
import { importFromRun, testsCatchOriginal } from "./support.mjs";

const { applyDiscount } = await importFromRun("src.mjs");

assert.equal(applyDiscount(101, 10), 91, "discount must return rounded integer cents");
assert.equal(applyDiscount(999, 15), 849, "fractional cents round to the nearest cent");
assert.equal(applyDiscount(100, 0), 100);
assert.equal(applyDiscount(1000, 10), 900);
assert.equal(applyDiscount(200, 50), 100);
for (const [price, percent] of [
  [333, 33],
  [1, 50],
  [12345, 7],
]) {
  assert.ok(Number.isInteger(applyDiscount(price, percent)), "result is integer cents");
}
assert.ok(
  testsCatchOriginal("bug-regression", "src.mjs"),
  "the project's tests must pass and must fail against the original defect",
);
