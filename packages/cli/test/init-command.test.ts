import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { UnknownAdapterError } from "@agentyx/adapters";
import { UnknownPackError } from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInitCommand,
  InitError,
  planNonInteractiveInit,
  runInitCommand,
} from "../src/commands/init.js";
import { createAgentyxProgram } from "../src/index.js";

const fixturesPath = fileURLToPath(
  new URL("../../../packages/core/test/fixtures", import.meta.url),
);

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-init-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe("agentyx init --yes", () => {
  it("creates deterministic config from explicit packs and performs no install", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });

    const output = await runInitCommand({
      packs: ["technical", "typescript", "efficiency"],
      enable: ["rtk"],
      targets: ["codex", "kimi"],
      yes: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(output).toBe(
      [
        "Created .agentyx.json",
        "",
        "Packs",
        "  technical",
        "  typescript",
        "  efficiency",
        "Enabled",
        "  rtk",
        "Targets",
        "  codex",
        "  kimi",
        "Next: agentyx doctor",
      ].join("\n"),
    );
    expect(JSON.parse(await readFile(join(projectDir, ".agentyx.json"), "utf8"))).toEqual({
      packs: ["technical", "typescript", "efficiency"],
      enable: ["rtk"],
      targets: ["codex", "kimi"],
    });
    expect(await readdir(projectDir)).not.toContain(".agents");
    expect(await readdir(projectDir)).not.toContain(".claude");
  });

  it("infers Angular packs safely but still requires explicit targets", async () => {
    await cp(join(fixturesPath, "angular-project"), projectDir, { recursive: true });

    await expect(
      planNonInteractiveInit({
        packs: [],
        enable: [],
        targets: [],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(/Pass at least one --target/);

    const plan = await planNonInteractiveInit({
      packs: [],
      enable: [],
      targets: ["codex"],
      yes: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(plan.packs).toEqual(["technical", "typescript", "angular"]);
  });

  it("refuses an existing config unless forced", async () => {
    await writeFile(join(projectDir, "package.json"), '{"devDependencies":{"typescript":"^5"}}\n');
    await writeFile(join(projectDir, ".agentyx.json"), '{"packs":["technical"]}\n');

    await expect(
      runInitCommand({
        packs: ["typescript"],
        enable: [],
        targets: ["codex"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(InitError);

    const output = await runInitCommand({
      packs: ["typescript"],
      enable: [],
      targets: ["codex"],
      yes: true,
      force: true,
      json: true,
      cwd: projectDir,
    });

    expect(JSON.parse(output)).toEqual({
      path: ".agentyx.json",
      replaced: true,
      packs: ["typescript"],
      enable: [],
      targets: ["codex"],
    });
  });

  it("rejects invalid packs and targets", async () => {
    await writeFile(join(projectDir, "package.json"), "{}\n");

    await expect(
      planNonInteractiveInit({
        packs: ["react"],
        enable: [],
        targets: ["codex"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(UnknownPackError);

    await expect(
      planNonInteractiveInit({
        packs: ["typescript"],
        enable: [],
        targets: ["opencode"],
        yes: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(UnknownAdapterError);
  });
});

describe("init command wiring", () => {
  it("is part of the top-level program", () => {
    expect(createAgentyxProgram().commands.map((command) => command.name())).toContain("init");
  });

  it("keeps prompt UI behind command wiring", () => {
    expect(createInitCommand().options.map((option) => option.long)).toEqual([
      "--pack",
      "--enable",
      "--target",
      "--yes",
      "--force",
      "--json",
    ]);
  });
});
