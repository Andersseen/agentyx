import assert from "node:assert/strict";
import { importFromRun } from "./support.mjs";

const { formatLabel } = await importFromRun("src.mjs");

assert.equal(formatLabel("  Sample  "), "Sample");
assert.equal(formatLabel(12), "12");
