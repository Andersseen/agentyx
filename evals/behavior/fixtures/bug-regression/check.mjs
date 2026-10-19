import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { applyDiscount } = await import(pathToFileURL(join(process.cwd(), "src.mjs")));

assert.equal(applyDiscount(101, 10), 91, "discount must return rounded integer cents");
assert.equal(applyDiscount(100, 0), 100);
