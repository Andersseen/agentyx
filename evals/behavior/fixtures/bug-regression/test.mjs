import assert from "node:assert/strict";
import { applyDiscount } from "./src.mjs";

assert.equal(applyDiscount(1000, 10), 900);
assert.equal(applyDiscount(100, 0), 100);
assert.equal(applyDiscount(200, 50), 100);
console.log("discount tests passed");
