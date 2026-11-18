// Shared helpers for the hidden benchmark checkers. Never copied into a run directory.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const runDirectory = process.cwd();

/** Imports a module from the run directory, never from the canonical fixture. */
export function importFromRun(file) {
  return import(pathToFileURL(join(runDirectory, file)).href);
}

/** The canonical, unmodified fixture file a checker can compare the run against. */
export function canonicalFile(scenario, file) {
  return fileURLToPath(new URL(`../fixtures/${scenario}/${file}`, import.meta.url));
}

/** Runs the project's own `test` script the way `npm test` would, without a package manager. */
export function runProjectTests(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const script = manifest.scripts?.test;
  if (typeof script !== "string" || !script.trim()) return false;
  const result = spawnSync(script, {
    cwd: directory,
    shell: true,
    encoding: "utf8",
    timeout: 30_000,
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" },
  });
  return result.status === 0;
}

/**
 * Whether the run's project tests would have caught the original defect: they pass on the run and
 * fail when the run's source file is swapped back to the canonical original.
 */
export function testsCatchOriginal(scenario, sourceFile) {
  if (!runProjectTests(runDirectory)) return false;
  const copy = mkdtempSync(join(tmpdir(), "agentyx-regression-"));
  try {
    cpSync(runDirectory, copy, {
      recursive: true,
      filter: (path) => !/[\\/](node_modules|\.git|\.agents|\.claude)([\\/]|$)/.test(path),
    });
    cpSync(canonicalFile(scenario, sourceFile), join(copy, sourceFile));
    return !runProjectTests(copy);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}
