import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TrustedSourceLoadError } from "../src/source/errors.js";
import { inspectTrustedSource } from "../src/source/inspection.js";

describe("inspectTrustedSource", () => {
  let projectDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-source-"));
    outsideDir = await mkdtemp(join(tmpdir(), "agentyx-source-outside-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it("inspects a local Superpowers plugin checkout without making it installable", async () => {
    await writeSuperpowersFixture(projectDir);

    const inspection = await inspectTrustedSource(projectDir, {
      name: "superpowers",
      path: ".agentyx/sources/superpowers",
      ref: "v5.1.0",
    });

    expect(inspection.manifest).toMatchObject({
      name: "superpowers",
      version: "5.1.0",
      repository: "https://github.com/obra/superpowers",
      license: "MIT",
    });
    expect(inspection.skills).toEqual([
      {
        name: "test-driven-development",
        description: "Use when implementing any feature or bugfix.",
        hasResources: true,
      },
      {
        name: "writing-plans",
        description: "Use when you have requirements for a multi-step task.",
        hasResources: false,
      },
    ]);
    expect(inspection.installable).toBe(false);
  });

  it("rejects a trusted source checkout symlinked outside the project", async () => {
    await mkdir(join(projectDir, ".agentyx", "sources"), { recursive: true });
    await symlink(outsideDir, join(projectDir, ".agentyx", "sources", "superpowers"));

    await expect(
      inspectTrustedSource(projectDir, {
        name: "superpowers",
        path: ".agentyx/sources/superpowers",
        ref: "v5.1.0",
      }),
    ).rejects.toThrow(TrustedSourceLoadError);
    await expect(
      inspectTrustedSource(projectDir, {
        name: "superpowers",
        path: ".agentyx/sources/superpowers",
        ref: "v5.1.0",
      }),
    ).rejects.toThrow(/outside the project/);
  });

  it("rejects a manifest for a different repository", async () => {
    await writeSuperpowersFixture(projectDir, { repository: "https://github.com/example/nope" });

    await expect(
      inspectTrustedSource(projectDir, {
        name: "superpowers",
        path: ".agentyx/sources/superpowers",
        ref: "v5.1.0",
      }),
    ).rejects.toThrow(/declares repository/);
  });
});

async function writeSuperpowersFixture(
  projectDir: string,
  overrides: { readonly repository?: string } = {},
): Promise<void> {
  const root = join(projectDir, ".agentyx", "sources", "superpowers");
  await mkdir(join(root, ".codex-plugin"), { recursive: true });
  await mkdir(join(root, "skills", "test-driven-development"), { recursive: true });
  await mkdir(join(root, "skills", "writing-plans"), { recursive: true });
  await writeFile(
    join(root, ".codex-plugin", "plugin.json"),
    JSON.stringify({
      name: "superpowers",
      version: "5.1.0",
      description: "Planning, TDD, debugging and delivery workflows.",
      repository: overrides.repository ?? "https://github.com/obra/superpowers",
      license: "MIT",
      skills: "../skills/",
    }),
    "utf8",
  );
  await writeFile(
    join(root, "skills", "test-driven-development", "SKILL.md"),
    "---\nname: test-driven-development\ndescription: Use when implementing any feature or bugfix.\n---\n\nWrite the test first.\n",
    "utf8",
  );
  await writeFile(
    join(root, "skills", "test-driven-development", "writing-good-tests.md"),
    "Write meaningful tests.\n",
    "utf8",
  );
  await writeFile(
    join(root, "skills", "writing-plans", "SKILL.md"),
    "---\nname: writing-plans\ndescription: Use when you have requirements for a multi-step task.\n---\n\nWrite a plan first.\n",
    "utf8",
  );
}
