import assert from "node:assert/strict";
import { normalizeChannel } from "./src.mjs";

assert.equal(normalizeChannel("  release notes  "), "release-notes");
assert.equal(normalizeChannel("release   notes"), "release-notes");
assert.equal(normalizeChannel("Release"), "release");
