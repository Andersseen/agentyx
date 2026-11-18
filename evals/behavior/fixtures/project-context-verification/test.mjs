import assert from "node:assert/strict";
import { normalizeChannel } from "./src.mjs";

assert.equal(normalizeChannel("Release"), "release");
assert.equal(normalizeChannel("release notes"), "release-notes");
console.log("channel tests passed");
