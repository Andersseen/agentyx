import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentyxManifestPath,
  builtInHookRegistry,
  builtInMcpServerRegistry,
  builtInSkillRegistry,
  loadInstallManifest,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IncompleteInstallError, InstallPathError, StaleInstallPlanError } from "../src/errors.js";
import { applyInstallPlans, runInstallPlans } from "../src/executor.js";
import { planInstall, planUninstall } from "../src/planner.js";

const skills = ["planning", "verification"].map((name) => builtInSkillRegistry.get(name));
const revised = skills.map((skill) => ({ ...skill, content: `${skill.content}\n\nRevised.` }));
const PLANNING = ".agents/skills/planning/SKILL.md";
const VERIFICATION = ".agents/skills/verification/SKILL.md";

describe("stale plans and partial failures", () => {
  let projectDir: string;
  const at = (relative: string) => join(projectDir, ...relative.split("/"));
  const read = (relative: string) => readFile(at(relative), "utf8");
  const lock = () => readFile(agentyxManifestPath(projectDir), "utf8").catch(() => undefined);

  async function install(
    input: Partial<Parameters<typeof planInstall>[0]> & { targets?: string[] } = {},
  ) {
    const manifest = await loadInstallManifest(projectDir);
    await applyInstallPlans(
      await planInstall({ targets: ["codex"], projectDir, skills, manifest, ...input }),
      { manifest },
    );
  }

  async function plan(input: Partial<Parameters<typeof planInstall>[0]> = {}) {
    const manifest = await loadInstallManifest(projectDir);
    const plans = await planInstall({ targets: ["codex"], projectDir, skills, manifest, ...input });

    return { plans, manifest };
  }

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "agentyx-stale-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  describe("preflight", () => {
    it("never overwrites a destination created after planning, and writes nothing", async () => {
      const { plans, manifest } = await plan();
      await mkdir(at(".agents/skills/verification"), { recursive: true });
      await writeFile(at(VERIFICATION), "mine\n");

      const error = await applyInstallPlans(plans, { manifest }).catch((cause) => cause);

      expect(error).toBeInstanceOf(StaleInstallPlanError);
      expect(error.code).toBe("stale_install_plan");
      expect(error.paths).toEqual([VERIFICATION]);
      expect(await read(VERIFICATION)).toBe("mine\n");
      await expect(readFile(at(PLANNING))).rejects.toThrow();
      expect(await lock()).toBeUndefined();
    });

    it("covers agent files too", async () => {
      const { builtInAgentRegistry } = await import("@agentyx/core");
      const agents = [builtInAgentRegistry.get("agentyx-reviewer")];
      const { plans, manifest } = await plan({ targets: ["claude"], skills: [], agents });
      await mkdir(at(".claude/agents"), { recursive: true });
      await writeFile(at(".claude/agents/agentyx-reviewer.md"), "mine\n");

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);
      expect(await read(".claude/agents/agentyx-reviewer.md")).toBe("mine\n");
    });

    it("never overwrites a managed file edited after planning, and keeps the lock", async () => {
      await install();
      const before = await lock();
      const { plans, manifest } = await plan({ skills: revised });
      await writeFile(at(VERIFICATION), "edited after planning\n");

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);

      expect(await read(VERIFICATION)).toBe("edited after planning\n");
      // The other update was never applied either: preflight rejects the whole run.
      expect(await read(PLANNING)).not.toContain("Revised.");
      expect(await lock()).toBe(before);
    });

    it("does not let --force authorize a state that appeared after planning", async () => {
      await mkdir(at(".agents/skills/planning"), { recursive: true });
      await writeFile(at(PLANNING), "A\n");
      const { plans, manifest } = await plan({ force: true });
      expect(plans[0]?.operations[0]?.status).toBe("update");
      await writeFile(at(PLANNING), "B\n");

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);

      expect(await read(PLANNING)).toBe("B\n");
      expect(await lock()).toBeUndefined();
    });

    it("does not let an unchanged file be claimed after it changed", async () => {
      await install();
      const before = await lock();
      const { plans, manifest } = await plan();
      expect(plans[0]?.operations.every((operation) => operation.status === "unchanged")).toBe(
        true,
      );
      await writeFile(at(PLANNING), "edited\n");

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);

      expect(await read(PLANNING)).toBe("edited\n");
      expect(await lock()).toBe(before);
    });

    it.each([
      [".mcp.json", { mcpServers: [builtInMcpServerRegistry.get("context7")] }],
      [".claude/settings.json", { hooks: [builtInHookRegistry.get("session-doctor-bootstrap")] }],
    ])("keeps a user edit to %s made after planning", async (path, desired) => {
      const original = `${JSON.stringify({ user: { keep: true } }, null, 2)}\n`;
      await mkdir(at(".claude"), { recursive: true });
      await writeFile(at(path), original);
      const { plans, manifest } = await plan({ targets: ["claude"], skills: [], ...desired });
      const edited = `${JSON.stringify({ user: { keep: true, added: "later" } }, null, 2)}\n`;
      await writeFile(at(path), edited);

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);

      expect(await read(path)).toBe(edited);
      expect(await lock()).toBeUndefined();
    });

    it("never deletes a managed file that changed after planning", async () => {
      await install();
      const before = await lock();
      const { plans, manifest } = await planUninstallFor();
      await writeFile(at(VERIFICATION), "edited\n");

      await expect(applyInstallPlans(plans, { manifest })).rejects.toThrow(StaleInstallPlanError);

      expect(await read(VERIFICATION)).toBe("edited\n");
      expect(await read(PLANNING)).toContain("planning");
      expect(await lock()).toBe(before);
    });

    it("treats a planned deletion whose file already vanished as satisfied", async () => {
      await install();
      const { plans, manifest } = await planUninstallFor();
      await rm(at(VERIFICATION));

      const results = await applyInstallPlans(plans, { manifest });

      expect(results[0]?.deleted).toEqual([PLANNING]);
      expect(await lock()).toBeUndefined();
    });

    it("applies a shared Codex and Kimi write once without flagging its own write", async () => {
      const { plans, manifest } = await plan({ targets: ["codex", "kimi"] });
      const seen: string[] = [];

      const results = await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: (path) => void seen.push(path),
        },
      );

      expect(seen).toEqual([PLANNING, VERIFICATION]);
      expect(results.flatMap((result) => result.written)).toEqual([PLANNING, VERIFICATION]);
      const recorded = await loadInstallManifest(projectDir);
      expect(recorded.entries.map((entry) => entry.targets)).toEqual([
        ["codex", "kimi"],
        ["codex", "kimi"],
      ]);
    });

    async function planUninstallFor() {
      const manifest = await loadInstallManifest(projectDir);

      return { plans: await planUninstall({ targets: ["codex"], projectDir, manifest }), manifest };
    }
  });

  describe("just-in-time validation and partial application", () => {
    it("reports an edit made after preflight as an incomplete install", async () => {
      const { plans, manifest } = await plan();

      const error = await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: async (path) => {
            if (path === VERIFICATION) {
              await mkdir(at(".agents/skills/verification"), { recursive: true });
              await writeFile(at(VERIFICATION), "mine\n");
            }
          },
        },
      ).catch((cause) => cause);

      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(error.code).toBe("incomplete_install");
      expect(error.completed).toEqual([PLANNING]);
      expect(error.pending).toEqual([VERIFICATION]);
      expect(error.message).not.toContain(projectDir);
      expect(await read(PLANNING)).toContain("planning");
      expect(await read(VERIFICATION)).toBe("mine\n");
      expect(await lock()).toBeUndefined();
    });

    it("reports a real I/O failure after earlier writes, without rolling back", async () => {
      const { plans, manifest } = await plan();

      const error = await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: async (path) => {
            if (path === VERIFICATION) {
              // A file where a directory has to go: the write fails on every platform.
              await mkdir(at(".agents/skills"), { recursive: true });
              await writeFile(at(".agents/skills/verification"), "blocker");
            }
          },
        },
      ).catch((cause) => cause);

      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(error.completed).toEqual([PLANNING]);
      expect(error.pending).toEqual([VERIFICATION]);
      expect(error.message).not.toContain(projectDir);
      expect(await read(PLANNING)).toContain("planning");
      expect(await lock()).toBeUndefined();
    });

    it("refuses a destination that became a symlink after preflight", async () => {
      const outside = await mkdtemp(join(tmpdir(), "agentyx-outside-"));
      const { plans, manifest } = await plan();

      try {
        const error = await runInstallPlans(
          plans,
          { manifest },
          {
            beforeMutation: async (path) => {
              if (path === VERIFICATION) {
                await symlink(outside, at(".agents/skills/verification"), "junction");
              }
            },
          },
        ).catch((cause) => cause);

        expect(error).toBeInstanceOf(IncompleteInstallError);
        expect(error.cause).toBeInstanceOf(InstallPathError);
        expect(await readdir(outside)).toEqual([]);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it("does not record a file written before a failure as owned on retry", async () => {
      const { plans, manifest } = await plan();
      await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: async (path) => {
            if (path === VERIFICATION) {
              await mkdir(at(".agents/skills/verification"), { recursive: true });
              await writeFile(at(VERIFICATION), "mine\n");
            }
          },
        },
      ).catch(() => undefined);

      // The lock never recorded the file written before the failure, so it is not Agentyx's:
      // once the desired content moves on, it is a conflict rather than an update.
      expect(await loadInstallManifest(projectDir)).toEqual({ version: 1, entries: [] });
      const retry = await plan({ skills: revised });

      expect(retry.plans[0]?.operations.map((operation) => operation.status)).toEqual([
        "conflict",
        "conflict",
      ]);
    });

    it("sees a half-updated managed file as drift on retry", async () => {
      await install();
      const { plans, manifest } = await plan({ skills: revised });
      await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: async (path) => {
            if (path === VERIFICATION) await writeFile(at(VERIFICATION), "edited\n");
          },
        },
      ).catch(() => undefined);

      const next = revised.map((skill) => ({ ...skill, content: `${skill.content}\n\nAgain.` }));
      const retry = await plan({ skills: next });

      // The old lock no longer matches the half-updated file: drift, never a silent overwrite.
      expect(retry.plans[0]?.operations.map((operation) => operation.status)).toEqual([
        "conflict",
        "conflict",
      ]);
      expect(await read(PLANNING)).toContain("Revised.");
    });

    it("recovers a half-finished deletion without recreating the removed file", async () => {
      await install();
      const original = await read(VERIFICATION);
      const { plans, manifest } = await planUninstallFor();
      const lockBefore = await lock();

      const error = await runInstallPlans(
        plans,
        { manifest },
        {
          beforeMutation: async (path) => {
            if (path === VERIFICATION) await writeFile(at(VERIFICATION), "edited\n");
          },
        },
      ).catch((cause) => cause);

      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(error.completed).toEqual([PLANNING]);
      expect(await lock()).toBe(lockBefore);
      await expect(readFile(at(PLANNING))).rejects.toThrow();

      // The user restores what Agentyx wrote; the retry finishes the job.
      await writeFile(at(VERIFICATION), original);
      const retried = await planUninstallFor();
      expect(retried.plans[0]?.deletions.map((operation) => operation.status)).toEqual([
        "unchanged",
        "delete",
      ]);
      await applyInstallPlans(retried.plans, { manifest: retried.manifest });
      expect(await lock()).toBeUndefined();
      await expect(readFile(at(PLANNING))).rejects.toThrow();
      await expect(readFile(at(VERIFICATION))).rejects.toThrow();
    });

    async function planUninstallFor() {
      const manifest = await loadInstallManifest(projectDir);

      return { plans: await planUninstall({ targets: ["codex"], projectDir, manifest }), manifest };
    }
  });

  describe("committing the lock", () => {
    it("reports a failed lock write, keeps provider changes and leaves no temporary file", async () => {
      const { plans, manifest } = await plan();
      await mkdir(agentyxManifestPath(projectDir));

      const error = await applyInstallPlans(plans, { manifest }).catch((cause) => cause);

      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(error.completed).toEqual([PLANNING, VERIFICATION]);
      expect(error.pending).toEqual([]);
      expect(await read(PLANNING)).toContain("planning");
      expect((await readdir(projectDir)).sort()).toEqual([".agents", ".agentyx.lock.json"]);
    });

    it("reports a failed lock removal after an uninstall", async () => {
      await install();
      const { plans, manifest } = await uninstallPlans();
      await rm(agentyxManifestPath(projectDir));
      await mkdir(agentyxManifestPath(projectDir));

      const error = await applyInstallPlans(plans, { manifest }).catch((cause) => cause);

      expect(error).toBeInstanceOf(IncompleteInstallError);
      expect(error.completed).toEqual([PLANNING, VERIFICATION]);
    });

    it("replaces the lock without leaving temporary files", async () => {
      await install();
      await install({ skills: revised });

      expect((await readdir(projectDir)).sort()).toEqual([".agents", ".agentyx.lock.json"]);
    });

    async function uninstallPlans() {
      const manifest = await loadInstallManifest(projectDir);

      return { plans: await planUninstall({ targets: ["codex"], projectDir, manifest }), manifest };
    }
  });
});
