import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
        "Next: agentyx install — writes these skills into Codex and Kimi Code.",
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

  /**
   * The whole point of `--install`: a first-time user reaches installed skills
   * from the one command they would think to type, without learning a second.
   */
  it("installs into every target when asked to, in the same run", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });

    const output = await runInitCommand({
      packs: ["typescript"],
      enable: [],
      targets: ["codex", "claude"],
      yes: true,
      install: true,
      force: false,
      json: false,
      cwd: projectDir,
    });

    expect(output).toContain("Created .agentyx.json");
    expect(output).toContain("Agentyx install");
    expect(output).toContain("Next: agentyx doctor");
    expect(
      await readFile(
        join(projectDir, ".agents", "skills", "typescript-strict", "SKILL.md"),
        "utf8",
      ),
    ).toContain("typescript-strict");
    expect(
      await readFile(
        join(projectDir, ".claude", "skills", "typescript-strict", "SKILL.md"),
        "utf8",
      ),
    ).toContain("typescript-strict");
    expect(await readdir(projectDir)).toContain(".agentyx.lock.json");
  });

  it("reports the install in JSON alongside the config it wrote", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });

    const report = JSON.parse(
      await runInitCommand({
        packs: ["typescript"],
        enable: [],
        targets: ["codex"],
        yes: true,
        install: true,
        force: false,
        json: true,
        cwd: projectDir,
      }),
    );

    expect(report.installed).toBe(true);
    expect(report.install.targets).toEqual(["codex"]);
    expect(report.install.summary.create).toBeGreaterThan(0);
  });

  /**
   * The config is written before the install runs, so a failing install must
   * say so — otherwise the user cannot tell whether anything happened.
   */
  it("says the config was created when the install cannot run", async () => {
    await cp(join(fixturesPath, "typescript-project"), projectDir, { recursive: true });
    await mkdir(join(projectDir, ".agents", "skills", "typescript-strict"), { recursive: true });
    await writeFile(
      join(projectDir, ".agents", "skills", "typescript-strict", "SKILL.md"),
      "hand-written, not Agentyx's\n",
      "utf8",
    );

    await expect(
      runInitCommand({
        packs: ["typescript"],
        enable: [],
        targets: ["codex"],
        yes: true,
        install: true,
        force: false,
        json: false,
        cwd: projectDir,
      }),
    ).rejects.toThrow(/\.agentyx\.json was created, but the installation did not run/);

    expect(await readFile(join(projectDir, ".agentyx.json"), "utf8")).toContain("typescript");
    expect(
      await readFile(
        join(projectDir, ".agents", "skills", "typescript-strict", "SKILL.md"),
        "utf8",
      ),
    ).toBe("hand-written, not Agentyx's\n");
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
      installed: false,
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
      "--install",
      "--force",
      "--json",
    ]);
  });
});
