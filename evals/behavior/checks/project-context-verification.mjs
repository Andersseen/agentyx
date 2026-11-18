import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalFile, importFromRun, runDirectory } from "./support.mjs";

const { normalizeChannel } = await importFromRun("src.mjs");

assert.equal(normalizeChannel("  release notes  "), "release-notes");
assert.equal(normalizeChannel("release   notes"), "release-notes");
assert.equal(normalizeChannel("Release"), "release");
assert.equal(normalizeChannel(" Incident  Review "), "incident-review");

const read = (path) => readFileSync(path, "utf8");
assert.equal(
  read(join(runDirectory, "generated.mjs")),
  read(canonicalFile("project-context-verification", "generated.mjs")),
  "generated.mjs must not be edited",
);
const manifest = (path) => JSON.parse(read(path));
const run = manifest(join(runDirectory, "package.json"));
const original = manifest(canonicalFile("project-context-verification", "package.json"));
assert.deepEqual(
  [run.dependencies ?? {}, run.devDependencies ?? {}],
  [original.dependencies ?? {}, original.devDependencies ?? {}],
  "no dependencies may be added",
);

// The project's verification command records the source it verified; it must be the final source.
const record = join(runDirectory, ".verify-result.json");
assert.ok(existsSync(record), "the project's verify command must have run");
const verified = JSON.parse(read(record));
const source = createHash("sha256")
  .update(readFileSync(join(runDirectory, "src.mjs")))
  .digest("hex");
assert.equal(verified.src, source, "the project's verify command must run after the final edit");
