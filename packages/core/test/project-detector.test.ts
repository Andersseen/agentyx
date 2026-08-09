import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildAgnoxConfig, detectProject, formatAgnoxConfig } from "../src/index.js";

const fixturesPath = fileURLToPath(new URL("fixtures", import.meta.url));

describe("detectProject", () => {
  it("detects a TypeScript project and recommends the TypeScript stack", async () => {
    const detection = await detectProject(join(fixturesPath, "typescript-project"));

    expect(detection.packageJson.present).toBe(true);
    expect(detection.packageManager).toMatchObject({
      name: "pnpm",
      source: "lockfile",
      ambiguous: false,
      lockfiles: ["pnpm-lock.yaml"],
    });
    expect(detection.detectedStacks).toEqual(["typescript"]);
    expect(detection.recommendedStack).toBe("typescript");
  });

  it("detects Angular from package metadata and recommends the Angular stack", async () => {
    const detection = await detectProject(join(fixturesPath, "angular-project"));

    expect(detection.packageManager).toMatchObject({
      name: "npm",
      source: "lockfile",
      ambiguous: false,
      lockfiles: ["package-lock.json"],
    });
    expect(detection.detectedStacks).toEqual(["typescript", "angular"]);
    expect(detection.recommendedStack).toBe("angular");
  });

  it("reports ambiguous lockfiles without guessing", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "agnox-detect-"));

    try {
      await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");
      await writeFile(join(projectDir, "pnpm-lock.yaml"), "", "utf8");
      await writeFile(join(projectDir, "package-lock.json"), "", "utf8");

      const detection = await detectProject(projectDir);

      expect(detection.packageManager).toMatchObject({
        name: undefined,
        source: "lockfile",
        ambiguous: true,
        lockfiles: ["pnpm-lock.yaml", "package-lock.json"],
      });
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("uses tsconfig.json as a TypeScript signal", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "agnox-detect-"));

    try {
      await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");
      await writeFile(join(projectDir, "tsconfig.json"), "{}\n", "utf8");

      const detection = await detectProject(projectDir);

      expect(detection.detectedStacks).toEqual(["typescript"]);
      expect(detection.recommendedStack).toBe("typescript");
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});

describe("formatAgnoxConfig", () => {
  it("renders deterministic JSON without a fragile schema path", () => {
    const config = buildAgnoxConfig({
      stack: "angular",
      profile: "lean",
      targets: ["codex", "kimi"],
    });

    expect(formatAgnoxConfig(config)).toBe(
      [
        "{",
        '  "extends": [',
        '    "angular"',
        "  ],",
        '  "profile": "lean",',
        '  "targets": [',
        '    "codex",',
        '    "kimi"',
        "  ]",
        "}",
        "",
      ].join("\n"),
    );
    expect(formatAgnoxConfig(config)).not.toContain("$schema");
  });

  it("matches JSON.parse output", () => {
    const config = buildAgnoxConfig({
      stack: "typescript",
      profile: "balanced",
      targets: ["claude"],
    });

    expect(JSON.parse(formatAgnoxConfig(config))).toEqual(config);
  });
});

describe("fixtures", () => {
  it("keeps fixture package JSON small", async () => {
    await expect(
      readFile(join(fixturesPath, "typescript-project", "package.json"), "utf8"),
    ).resolves.toContain('"typescript"');
  });
});
