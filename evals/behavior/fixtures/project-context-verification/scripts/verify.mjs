// Project verification: runs the tests and records which source revision they verified.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const tests = spawnSync(process.execPath, ["test.mjs"], { stdio: "inherit" });
if (tests.status !== 0) {
  console.error("verify: tests failed");
  process.exit(1);
}
const src = createHash("sha256").update(readFileSync("src.mjs")).digest("hex");
writeFileSync(".verify-result.json", `${JSON.stringify({ src }, null, 2)}\n`);
console.log("verify: passed");
