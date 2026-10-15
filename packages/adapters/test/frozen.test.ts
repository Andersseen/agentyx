import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtInSkillRegistry,
  hashContent,
  type InstallManifest,
  loadInstallManifest,
  type ResolutionSnapshot,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrozenInstallError, StaleInstallPlanError } from "../src/errors.js";
import { applyInstallPlans, runInstallPlans } from "../src/executor.js";
import { validateFrozenPlans } from "../src/frozen.js";
import { planInstall } from "../src/planner.js";

const skills = ["planning"].map((name) => builtInSkillRegistry.get(name));
const LOCK = ".agentyx.lock.json";
const PLANNING = ".agents/skills/planning/SKILL.md";
const resolution: ResolutionSnapshot = {
  agentyxVersion: "0.0.0-test",
  configHash: hashContent("a"),
  targets: ["codex"],
  skills: [],
  mcpServers: [],
  tools: [],
  hooks: [],
  agents: [],
};

let projectDir: string;
let manifest: InstallManifest;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-frozen-adapters-"));
  await applyInstallPlans(await plan(), {
    projectDir,
    commit: { kind: "v2-complete", resolution },
  });
  manifest = await loadInstallManifest(projectDir);
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const plan = (current?: InstallManifest) =>
  planInstall({
    targets: ["codex"],
    projectDir,
    skills,
    ...(current === undefined ? {} : { manifest: current }),
  });
const lockBytes = () => readFile(join(projectDir, LOCK), "utf8");

describe("read-only commit intent", () => {
  it("never rewrites the lock, even when ownership would change it", async () => {
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(join(projectDir, LOCK), old, old);
    const bytes = await lockBytes();
    const canonical = await readFile(join(projectDir, PLANNING), "utf8");
    await rm(join(projectDir, PLANNING));
    await utimes(join(projectDir, LOCK), old, old);

    await applyInstallPlans(await plan(manifest), {
      manifest,
      projectDir,
      commit: { kind: "read-only" },
    });

    expect(await readFile(join(projectDir, PLANNING), "utf8")).toBe(canonical);
    expect(await lockBytes()).toBe(bytes);
    expect((await stat(join(projectDir, LOCK))).mtime.getTime()).toBe(old.getTime());
  });

  it("does not remove an otherwise empty lock", async () => {
    const bytes = await lockBytes();

    await applyInstallPlans([], { projectDir, commit: { kind: "read-only" } });

    expect(await lockBytes()).toBe(bytes);
  });
});

describe("validateFrozenPlans", () => {
  it("accepts an already satisfied project", async () => {
    expect(validateFrozenPlans(await plan(manifest), manifest)).toEqual([]);
  });

  it("returns a missing owned Skill as restorable", async () => {
    await rm(join(projectDir, PLANNING));

    expect(validateFrozenPlans(await plan(manifest), manifest)).toEqual([PLANNING]);
  });

  it("rejects an edited Skill, whatever the planner calls it", async () => {
    await writeFile(join(projectDir, PLANNING), "edited\n", "utf8");

    const plans = await plan(manifest);

    expect(() => validateFrozenPlans(plans, manifest)).toThrow(
      expect.objectContaining({ code: "frozen_installation_change_required" }),
    );
  });

  it("rejects deletions", async () => {
    const pruned = await planInstall({
      targets: ["codex"],
      projectDir,
      skills: [],
      manifest,
      prune: true,
    });

    expect(() => validateFrozenPlans(pruned, manifest)).toThrow(FrozenInstallError);
  });
});

describe("just-in-time protection", () => {
  it("lets a stale plan win when the destination appears after validation", async () => {
    await rm(join(projectDir, PLANNING));
    const plans = await plan(manifest);
    expect(validateFrozenPlans(plans, manifest)).toEqual([PLANNING]);

    const error = await runInstallPlans(
      plans,
      { manifest, projectDir, commit: { kind: "read-only" } },
      { beforeMutation: () => writeFile(join(projectDir, PLANNING), "someone else\n", "utf8") },
    ).catch((cause) => cause);

    expect(error).toBeInstanceOf(StaleInstallPlanError);
    expect(await readFile(join(projectDir, PLANNING), "utf8")).toBe("someone else\n");
  });
});
