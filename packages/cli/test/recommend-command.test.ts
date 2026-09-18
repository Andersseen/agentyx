import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRecommendCommand, runRecommendCommand } from "../src/commands/recommend.js";
import { createAgentyxProgram } from "../src/index.js";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-recommend-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writePackageJson(content: Record<string, unknown>): Promise<void> {
  await writeFile(join(projectDir, "package.json"), JSON.stringify(content), "utf8");
}

describe("agentyx recommend", () => {
  it("recommends nothing for an empty directory", async () => {
    const output = await runRecommendCommand({ json: false, cwd: projectDir });

    expect(output).toContain("Agentyx recommendations");
    expect(output).toContain("Detected\n  (none)");
    expect(output).toContain("Packs\n  (none)");
    expect(output).toContain("Optional capabilities\n  (none)");
  });

  it("recommends technical and typescript, with reasons, for a plain TypeScript project", async () => {
    await writePackageJson({ devDependencies: { typescript: "^5.9.0" } });
    await writeFile(join(projectDir, "tsconfig.json"), "{}\n", "utf8");

    const output = await runRecommendCommand({ json: false, cwd: projectDir });

    expect(output).toContain("Detected\n  TypeScript");
    expect(output).toContain("technical      high");
    expect(output).toContain("typescript     high");
    expect(output).toContain("Detected TypeScript (typescript) in devDependencies.");
    expect(output).toContain("tsconfig.json detected.");
    expect(output).not.toContain("angular");
  });

  it("recommends angular, testing, devops, observability and their capabilities together", async () => {
    await writePackageJson({
      dependencies: { "@angular/core": "^20.0.0", "@sentry/angular": "^8.0.0" },
      devDependencies: { typescript: "^5.9.0", "@playwright/test": "^1.40.0" },
    });
    await writeFile(join(projectDir, "Dockerfile"), "FROM node\n", "utf8");
    await mkdir(join(projectDir, ".github", "workflows"), { recursive: true });

    const output = await runRecommendCommand({ json: false, cwd: projectDir });

    expect(output).toContain(
      "Detected\n  Angular\n  TypeScript\n  Playwright\n  Sentry\n  Docker\n  GitHub Actions",
    );
    expect(output).toContain("angular        high");
    expect(output).toContain("testing        high");
    expect(output).toContain("devops         high");
    expect(output).toContain("observability  high");
    expect(output).toContain("Optional capabilities");
    expect(output).toContain("  playwright\n    Playwright is already part of this project");
    expect(output).toContain("  sentry\n    Sentry is already configured as a dependency.");
  });

  it("never enables anything and never writes to the project", async () => {
    await writePackageJson({ devDependencies: { vitest: "^2.0.0" } });
    const before = await readdir(projectDir);

    await runRecommendCommand({ json: false, cwd: projectDir });
    await runRecommendCommand({ json: true, cwd: projectDir });

    expect(await readdir(projectDir)).toEqual(before);
  });

  it("is unaffected by a missing or broken .agentyx.json", async () => {
    await writePackageJson({ devDependencies: { typescript: "^5.9.0" } });
    await writeFile(join(projectDir, ".agentyx.json"), "{ not json", "utf8");

    const output = await runRecommendCommand({ json: false, cwd: projectDir });

    expect(output).toContain("technical      high");
  });

  it("prints stable JSON with signals, packs and capabilities, and nothing else", async () => {
    await writePackageJson({ devDependencies: { typescript: "^5.9.0" } });

    const output = await runRecommendCommand({ json: true, cwd: projectDir });
    const parsed = JSON.parse(output);

    expect(Object.keys(parsed).sort()).toEqual(["capabilities", "packs", "signals"]);
    expect(parsed.packs.map((pack: { name: string }) => pack.name)).toEqual([
      "technical",
      "typescript",
    ]);
    expect(parsed.signals.projectDir).toBe(projectDir);
  });

  it("recommends rtk only when efficiency is already configured and rtk is on PATH", async () => {
    await writePackageJson({});
    await writeFile(
      join(projectDir, ".agentyx.json"),
      JSON.stringify({ packs: ["efficiency"], targets: ["codex"] }),
      "utf8",
    );
    await mkdir(join(projectDir, "bin"), { recursive: true });
    await writeFile(join(projectDir, "bin", "rtk"), "#!/bin/sh\n", "utf8");
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(join(projectDir, "bin", "rtk"), 0o755),
    );
    const originalPath = process.env.PATH;
    process.env.PATH = `${join(projectDir, "bin")}${originalPath === undefined ? "" : `:${originalPath}`}`;

    try {
      const output = await runRecommendCommand({ json: false, cwd: projectDir });

      expect(output).toContain("  rtk\n    RTK is already installed locally.");
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
    }
  });
});

describe("recommend command wiring", () => {
  it("is part of the top-level program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("recommend");
  });

  it("has stable options", () => {
    expect(createRecommendCommand().options.map((option) => option.long)).toEqual(["--json"]);
  });
});
