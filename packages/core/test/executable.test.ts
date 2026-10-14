import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executableCandidates, isExecutableOnPath } from "../src/project/executable.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("executable lookup", () => {
  it("finds a bare executable on PATH and ignores missing commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentyx-executable-"));
    directories.push(directory);
    const executable = join(directory, "local-tool");
    await writeFile(executable, "#!/bin/sh\n", "utf8");
    await chmod(executable, 0o755);

    expect(await isExecutableOnPath("local-tool", { env: { PATH: directory } })).toBe(true);
    expect(await isExecutableOnPath("missing-tool", { env: { PATH: directory } })).toBe(false);
  });

  it("resolves project-relative commands against the supplied cwd", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentyx-executable-"));
    directories.push(directory);
    const executable = join(directory, "tools", "mcp");
    await mkdir(join(directory, "tools"));
    await writeFile(executable, "#!/bin/sh\n", "utf8");
    await chmod(executable, 0o755);

    expect(await isExecutableOnPath("./tools/mcp", { cwd: directory, env: { PATH: "" } })).toBe(
      true,
    );
  });

  it("generates Windows executable suffix candidates without invoking them", () => {
    expect(executableCandidates("npx", "win32", ".COM;.EXE;.BAT;.CMD")).toEqual([
      "npx",
      "npx.com",
      "npx.exe",
      "npx.bat",
      "npx.cmd",
    ]);
    expect(executableCandidates("npx.cmd", "win32", ".EXE;.CMD")).toEqual(["npx.cmd"]);
  });
});
