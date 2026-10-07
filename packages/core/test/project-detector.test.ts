import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildAgentyxConfig, detectProject, formatAgentyxConfig } from "../src/index.js";

const fixturesPath = fileURLToPath(new URL("fixtures", import.meta.url));

describe("detectProject", () => {
  it("detects a TypeScript project", async () => {
    const detection = await detectProject(join(fixturesPath, "typescript-project"));

    expect(detection.packageJson.present).toBe(true);
    expect(detection.packageManager).toMatchObject({
      name: "pnpm",
      source: "lockfile",
      ambiguous: false,
      lockfiles: ["pnpm-lock.yaml"],
    });
    expect(detection.signals.typescript).toMatchObject({
      dependency: { dependency: "typescript", field: "devDependencies" },
      tsconfig: true,
    });
    expect(detection.signals.angular).toBeUndefined();
  });

  it("detects Angular from package metadata", async () => {
    const detection = await detectProject(join(fixturesPath, "angular-project"));

    expect(detection.packageManager).toMatchObject({
      name: "npm",
      source: "lockfile",
      ambiguous: false,
      lockfiles: ["package-lock.json"],
    });
    expect(detection.signals.angular).toEqual({
      dependency: "@angular/core",
      field: "dependencies",
    });
    expect(detection.signals.typescript.dependency).toEqual({
      dependency: "typescript",
      field: "devDependencies",
    });
  });

  it("reports ambiguous lockfiles without guessing", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));

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
    const projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));

    try {
      await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");
      await writeFile(join(projectDir, "tsconfig.json"), "{}\n", "utf8");

      const detection = await detectProject(projectDir);

      expect(detection.signals.typescript).toEqual({ dependency: undefined, tsconfig: true });
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("detects known devops, testing, observability and data signals", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));

    try {
      await writeFile(
        join(projectDir, "package.json"),
        JSON.stringify({
          devDependencies: { vitest: "^2.0.0", "@playwright/test": "^1.0.0" },
          dependencies: { "@sentry/node": "^8.0.0", "@supabase/supabase-js": "^2.0.0" },
        }),
        "utf8",
      );
      await writeFile(join(projectDir, "Dockerfile"), "FROM node\n", "utf8");

      const detection = await detectProject(projectDir);

      expect(detection.signals.testFrameworks.map((match) => match.dependency)).toEqual([
        "vitest",
        "@playwright/test",
      ]);
      expect(detection.signals.browserTesting.map((match) => match.dependency)).toEqual([
        "@playwright/test",
      ]);
      expect(detection.signals.observability).toEqual([
        { dependency: "@sentry/node", field: "dependencies" },
      ]);
      expect(detection.signals.dataTooling).toEqual([
        { dependency: "@supabase/supabase-js", field: "dependencies" },
      ]);
      expect(detection.signals.containers).toEqual({ dockerfile: true, compose: false });
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("detects monorepo markers", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));

    try {
      await writeFile(join(projectDir, "package.json"), "{}\n", "utf8");
      await writeFile(
        join(projectDir, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
        "utf8",
      );

      const detection = await detectProject(projectDir);

      expect(detection.signals.monorepo).toEqual({
        detected: true,
        markers: ["pnpm-workspace.yaml"],
      });
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});

describe("formatAgentyxConfig", () => {
  it("renders deterministic JSON without a fragile schema path", () => {
    const config = buildAgentyxConfig({
      packs: ["technical", "typescript", "angular"],
      enable: ["rtk"],
      targets: ["codex", "kimi"],
    });

    expect(formatAgentyxConfig(config)).toBe(
      [
        "{",
        '  "packs": [',
        '    "technical",',
        '    "typescript",',
        '    "angular"',
        "  ],",
        '  "enable": [',
        '    "rtk"',
        "  ],",
        '  "targets": [',
        '    "codex",',
        '    "kimi"',
        "  ]",
        "}",
        "",
      ].join("\n"),
    );
    expect(formatAgentyxConfig(config)).not.toContain("$schema");
  });

  it("matches JSON.parse output", () => {
    const config = buildAgentyxConfig({
      packs: ["typescript"],
      targets: ["claude"],
    });

    expect(JSON.parse(formatAgentyxConfig(config))).toEqual(config);
  });
});

describe("fixtures", () => {
  it("keeps fixture package JSON small", async () => {
    await expect(
      readFile(join(fixturesPath, "typescript-project", "package.json"), "utf8"),
    ).resolves.toContain('"typescript"');
  });

  describe("rust detection", () => {
    async function inRustProject(
      files: Record<string, string>,
      check: (signals: Awaited<ReturnType<typeof detectProject>>["signals"]) => void,
    ): Promise<void> {
      const projectDir = await mkdtemp(join(tmpdir(), "agentyx-detect-"));

      try {
        for (const [name, content] of Object.entries(files)) {
          await writeFile(join(projectDir, name), content, "utf8");
        }

        check((await detectProject(projectDir)).signals);
      } finally {
        await rm(projectDir, { recursive: true, force: true });
      }
    }

    const pkg = '[package]\nname = "demo"\nversion = "0.1.0"\n';

    it("detects a crate from Cargo.toml alone", async () => {
      await inRustProject({ "Cargo.toml": pkg }, (signals) => {
        expect(signals.rust).toEqual({
          detected: true,
          workspace: false,
          cargoLock: false,
          toolchainFile: undefined,
        });
      });
    });

    it("records Cargo.lock and the toolchain file as supporting facts", async () => {
      await inRustProject(
        { "Cargo.toml": pkg, "Cargo.lock": "", "rust-toolchain.toml": "[toolchain]\n" },
        (signals) => {
          expect(signals.rust).toMatchObject({
            detected: true,
            cargoLock: true,
            toolchainFile: "rust-toolchain.toml",
          });
        },
      );
      await inRustProject({ "Cargo.toml": pkg, "rust-toolchain": "stable\n" }, (signals) => {
        expect(signals.rust.toolchainFile).toBe("rust-toolchain");
      });
    });

    it("detects a workspace manifest", async () => {
      await inRustProject({ "Cargo.toml": '[workspace]\nmembers = ["crates/*"]\n' }, (signals) => {
        expect(signals.rust).toMatchObject({ detected: true, workspace: true });
      });
    });

    it("does not detect Rust from stray .rs files or a non-manifest Cargo.toml", async () => {
      await inRustProject({ "main.rs": "fn main() {}\n" }, (signals) => {
        expect(signals.rust.detected).toBe(false);
      });
      await inRustProject({ "Cargo.toml": "# nothing here\n" }, (signals) => {
        expect(signals.rust.detected).toBe(false);
      });
    });

    it("does not detect Rust in an empty directory", async () => {
      await inRustProject({}, (signals) => {
        expect(signals.rust.detected).toBe(false);
      });
    });

    it("detects Rust next to a package.json without disturbing TypeScript detection", async () => {
      await inRustProject(
        { "Cargo.toml": pkg, "package.json": "{}\n", "tsconfig.json": "{}\n" },
        (signals) => {
          expect(signals.rust.detected).toBe(true);
          expect(signals.typescript.tsconfig).toBe(true);
        },
      );
    });
  });
});
