import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { builtInAdapterRegistry, detectConfiguredTargets } from "../src/index.js";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("detectConfiguredTargets", () => {
  it("reports nothing for a project with no agent of its own", async () => {
    expect(await detectConfiguredTargets(projectDir)).toEqual([]);
  });

  it("reports the provider whose own directory exists", async () => {
    await mkdir(join(projectDir, ".claude"), { recursive: true });

    expect(await detectConfiguredTargets(projectDir)).toEqual(["claude"]);
  });

  it("accepts a marker file as well as a marker directory", async () => {
    await writeFile(join(projectDir, "CLAUDE.md"), "# instructions\n", "utf8");

    expect(await detectConfiguredTargets(projectDir)).toEqual(["claude"]);
  });

  it("reports every provider present, in registration order", async () => {
    await mkdir(join(projectDir, ".kimi-code"), { recursive: true });
    await mkdir(join(projectDir, ".codex"), { recursive: true });

    expect(await detectConfiguredTargets(projectDir)).toEqual(["codex", "kimi"]);
  });

  /**
   * The regression that motivates markers at all: Codex and Kimi Code share
   * `.agents/skills`, so the skills directory can never say which one is used.
   */
  it("does not treat the shared skills directory as a provider marker", async () => {
    await mkdir(join(projectDir, ".agents", "skills"), { recursive: true });

    expect(await detectConfiguredTargets(projectDir)).toEqual([]);
  });

  it("still reports the shared directory as present through detect", async () => {
    await mkdir(join(projectDir, ".agents", "skills"), { recursive: true });

    const detection = await builtInAdapterRegistry.get("codex").detect(projectDir);

    expect(detection).toMatchObject({ target: "codex", present: true, configured: false });
  });
});
