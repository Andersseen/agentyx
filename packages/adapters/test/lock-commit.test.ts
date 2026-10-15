import { chmod, mkdtemp, readFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtInSkillRegistry,
  hashContent,
  loadInstallManifest,
  type ResolutionSnapshot,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IncompleteInstallError, StaleInstallPlanError } from "../src/errors.js";
import { applyInstallPlans, runInstallPlans } from "../src/executor.js";
import { planInstall } from "../src/planner.js";

const skills = ["planning"].map((name) => builtInSkillRegistry.get(name));
const LOCK = ".agentyx.lock.json";

function snapshot(seed: string): ResolutionSnapshot {
  return {
    agentyxVersion: "0.0.0-test",
    configHash: hashContent(seed),
    targets: ["codex"],
    skills: [],
    mcpServers: [],
    tools: [],
    hooks: [],
    agents: [],
  };
}

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "agentyx-lock-commit-"));
});

afterEach(async () => {
  await chmod(projectDir, 0o755).catch(() => undefined);
  await rm(projectDir, { recursive: true, force: true });
});

async function plans(manifest?: Awaited<ReturnType<typeof loadInstallManifest>>) {
  return planInstall({
    targets: ["codex"],
    projectDir,
    skills,
    ...(manifest === undefined ? {} : { manifest }),
  });
}

async function lockBytes(): Promise<string> {
  return readFile(join(projectDir, LOCK), "utf8");
}

describe("manifest commit intent", () => {
  it("writes version 2 with the reviewed snapshot for v2-complete", async () => {
    await applyInstallPlans(await plans(), {
      projectDir,
      commit: { kind: "v2-complete", resolution: snapshot("a") },
    });

    const manifest = await loadInstallManifest(projectDir);
    expect(manifest.version).toBe(2);
    expect(manifest.version === 2 && manifest.resolution?.configHash).toBe(hashContent("a"));
    expect(manifest.entries).toHaveLength(1);
  });

  it("writes version 2 with a null resolution for v2-incomplete", async () => {
    await applyInstallPlans(await plans(), { projectDir, commit: { kind: "v2-incomplete" } });

    const manifest = await loadInstallManifest(projectDir);
    expect(manifest).toMatchObject({ version: 2, resolution: null });
  });

  it("keeps a version-1 lock at version 1 for preserve-version", async () => {
    await applyInstallPlans(await plans());

    expect((await loadInstallManifest(projectDir)).version).toBe(1);
  });

  it("commits a complete snapshot with no provider plans and no ownership", async () => {
    await applyInstallPlans([], {
      projectDir,
      commit: { kind: "v2-complete", resolution: { ...snapshot("empty"), targets: [] } },
    });

    expect(JSON.parse(await lockBytes())).toMatchObject({ version: 2, entries: [] });
  });

  it("removes an empty lock unless the snapshot is complete", async () => {
    await applyInstallPlans([], { projectDir, commit: { kind: "v2-incomplete" } });

    await expect(lockBytes()).rejects.toThrow();
  });

  it("leaves bytes and mtime alone when nothing changed", async () => {
    const commit = { kind: "v2-complete", resolution: snapshot("same") } as const;
    await applyInstallPlans(await plans(), { projectDir, commit });
    const path = join(projectDir, LOCK);
    const old = new Date("2020-01-01T00:00:00Z");
    await utimes(path, old, old);
    const before = await lockBytes();

    await applyInstallPlans(await plans(await loadInstallManifest(projectDir)), {
      projectDir,
      manifest: await loadInstallManifest(projectDir),
      commit,
    });

    expect(await lockBytes()).toBe(before);
    expect((await stat(path)).mtime.getTime()).toBe(old.getTime());
  });

  it("rewrites the lock for a snapshot-only change", async () => {
    await applyInstallPlans(await plans(), {
      projectDir,
      commit: { kind: "v2-complete", resolution: snapshot("one") },
    });
    const manifest = await loadInstallManifest(projectDir);

    await applyInstallPlans(await plans(manifest), {
      projectDir,
      manifest,
      commit: { kind: "v2-complete", resolution: snapshot("two") },
    });

    const next = await loadInstallManifest(projectDir);
    expect(next.version === 2 && next.resolution?.configHash).toBe(hashContent("two"));
  });

  it("invalidates a complete snapshot on v2-incomplete", async () => {
    await applyInstallPlans(await plans(), {
      projectDir,
      commit: { kind: "v2-complete", resolution: snapshot("one") },
    });
    const manifest = await loadInstallManifest(projectDir);

    await applyInstallPlans(await plans(manifest), {
      projectDir,
      manifest,
      commit: { kind: "v2-incomplete" },
    });

    expect(await loadInstallManifest(projectDir)).toMatchObject({ version: 2, resolution: null });
  });

  it("keeps the previous lock when the plan went stale", async () => {
    await applyInstallPlans(await plans(), {
      projectDir,
      commit: { kind: "v2-complete", resolution: snapshot("one") },
    });
    const manifest = await loadInstallManifest(projectDir);
    const stale = await plans(manifest);
    const before = await lockBytes();
    await rm(join(projectDir, ".agents/skills/planning/SKILL.md"));

    await expect(
      applyInstallPlans(stale, {
        projectDir,
        manifest,
        commit: { kind: "v2-complete", resolution: snapshot("two") },
      }),
    ).rejects.toThrow(StaleInstallPlanError);
    expect(await lockBytes()).toBe(before);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "does not publish a snapshot when the final lock write fails",
    async () => {
      await applyInstallPlans(await plans(), {
        projectDir,
        commit: { kind: "v2-complete", resolution: snapshot("one") },
      });
      const manifest = await loadInstallManifest(projectDir);
      const before = await lockBytes();
      await rm(join(projectDir, ".agents/skills/planning/SKILL.md"));
      const updating = await plans(manifest);

      const error = await runInstallPlans(
        updating,
        { projectDir, manifest, commit: { kind: "v2-complete", resolution: snapshot("two") } },
        { beforeMutation: () => chmod(projectDir, 0o555) },
      ).catch((cause) => cause);

      await chmod(projectDir, 0o755);
      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(await lockBytes()).toBe(before);
    },
  );
});
