import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { UnknownAdapterError } from "@agnox/adapters";
import { UnknownStackError } from "@agnox/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInitCommand,
  InitError,
  planNonInteractiveInit,
  runInitCommand,
} from "../src/commands/init.js";
import { createAgnoxProgram } from "../src/index.js";

const fixturesPath = fileURLToPath(
  new URL("../../../packages/core/test/fixtures", import.meta.url),
);

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agnox-init-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("agnox init --yes", () => {
  it("creates deterministic config from explicit options and performs no install", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });

    const output = await runInitCommand({
      stack: "typescript",
      profile: "lean",
      targets: ["codex", "kimi"],
      yes: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(output).toBe(
      [
        "Created .agnox.json",
        "",
        "Stack",
        "  typescript",
        "Profile",
        "  lean",
        "Targets",
        "  codex",
        "  kimi",
        "Next: agnox doctor",
      ].join("\n"),
    );
    expect(await readFile(join(projectDir, ".agnox.json"), "utf8")).toBe(
      [
        "{",
        '  "extends": [',
        '    "typescript"',
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
    expect(await readdir(projectDir)).not.toContain(".agents");
    expect(await readdir(projectDir)).not.toContain(".claude");
  });

  it("infers Angular safely but still requires explicit targets", async () => {
    await cp(join(fixturesPath, "angular-project"), projectDir, { recursive: true });

    await expect(
      planNonInteractiveInit({
        stack: undefined,
        profile: undefined,
        targets: [],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(/Pass at least one --target/);

    const plan = await planNonInteractiveInit({
      stack: undefined,
      profile: undefined,
      targets: ["codex"],
      yes: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(plan.stack).toBe("angular");
    expect(plan.profile).toBe("lean");
  });

  it("uses the selected profile", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });

    await runInitCommand({
      stack: undefined,
      profile: "autonomous",
      targets: ["claude"],
      yes: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(JSON.parse(await readFile(join(projectDir, ".agnox.json"), "utf8"))).toEqual({
      extends: ["typescript"],
      profile: "autonomous",
      targets: ["claude"],
    });
  });

  it("refuses an existing config unless forced", async () => {
    await writeFile(join(projectDir, "package.json"), '{"devDependencies":{"typescript":"^5"}}\n');
    await writeFile(join(projectDir, ".agnox.json"), '{"extends":["core"]}\n');

    await expect(
      runInitCommand({
        stack: "typescript",
        profile: "lean",
        targets: ["codex"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(InitError);

    const output = await runInitCommand({
      stack: "typescript",
      profile: "lean",
      targets: ["codex"],
      yes: true,
      force: true,
      json: true,
      cwd: projectDir,
    });

    expect(JSON.parse(output)).toEqual({
      path: ".agnox.json",
      replaced: true,
      stack: "typescript",
      profile: "lean",
      targets: ["codex"],
    });
  });

  it("rejects invalid stacks and targets", async () => {
    await writeFile(join(projectDir, "package.json"), "{}\n");

    await expect(
      planNonInteractiveInit({
        stack: "react",
        profile: "lean",
        targets: ["codex"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(UnknownStackError);

    await expect(
      planNonInteractiveInit({
        stack: "typescript",
        profile: "lean",
        targets: ["opencode"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(UnknownAdapterError);
  });

  it("errors when no stack can be inferred", async () => {
    await mkdir(join(projectDir, "src"));

    await expect(
      planNonInteractiveInit({
        stack: undefined,
        profile: undefined,
        targets: ["codex"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(/Could not infer/);
  });
});

describe("init command wiring", () => {
  it("is part of the top-level program", () => {
    expect(createAgnoxProgram().commands.map((command) => command.name())).toContain("init");
  });

  it("keeps prompt UI behind command wiring", () => {
    expect(createInitCommand().options.map((option) => option.long)).toEqual([
      "--stack",
      "--profile",
      "--target",
      "--yes",
      "--force",
      "--json",
    ]);
  });
});
