import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtInAgentRegistry,
  emptyInstallManifest,
  loadInstallManifest,
  parseInstallManifest,
} from "@agentyx/core";
import { afterEach, describe, expect, it } from "vitest";
import { applyInstallPlans } from "../src/executor.js";
import { planInstall } from "../src/planner.js";

const roots: string[] = [];
async function project(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "agentyx-agent-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project agent installation", () => {
  it("renders documented Claude, Kimi, and Codex formats from the same definition", async () => {
    const cwd = await project();
    const definition = builtInAgentRegistry.get("agentyx-reviewer");
    const plans = await planInstall({
      targets: ["claude", "kimi", "codex"],
      projectDir: cwd,
      skills: [],
      agents: [definition],
    });
    const paths = plans.map((plan) => plan.agentOperations[0]?.relativePath);
    expect(paths).toEqual([
      ".claude/agents/agentyx-reviewer.md",
      ".agents/agents/agentyx-reviewer.md",
      ".codex/agents/agentyx-reviewer.toml",
    ]);
    const claude = plans[0]?.agentOperations[0]?.content ?? "";
    const kimi = plans[1]?.agentOperations[0]?.content ?? "";
    const codex = plans[2]?.agentOperations[0]?.content ?? "";
    expect(claude).toContain("tools: Read, Grep, Glob");
    expect(claude).toContain(definition.instructions);
    expect(kimi).toContain("override: false");
    expect(kimi).toContain("tools: Read, Grep, Glob");
    expect(codex).toContain('sandbox_mode = "read-only"');
    expect(plans.every((plan) => plan.agentOperations[0]?.status === "create")).toBe(true);
  });

  it("records, updates, prunes, and preserves unrelated agent files", async () => {
    const cwd = await project();
    const unrelated = join(cwd, ".claude", "agents", "my-agent.md");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(join(cwd, ".claude", "agents"), { recursive: true }),
    );
    await writeFile(unrelated, "user owned\n");
    const manifest = emptyInstallManifest();
    const first = await planInstall({
      targets: ["claude"],
      projectDir: cwd,
      skills: [],
      agents: [builtInAgentRegistry.get("agentyx-reviewer")],
      manifest,
    });
    await applyInstallPlans(first, { manifest });
    const installed = await loadInstallManifest(cwd);
    expect(installed.entries).toHaveLength(1);
    expect(installed.entries[0]?.kind).toBe("agent");
    const second = await planInstall({
      targets: ["claude"],
      projectDir: cwd,
      skills: [],
      agents: [builtInAgentRegistry.get("agentyx-reviewer")],
      manifest: installed,
    });
    expect(second[0]?.agentOperations[0]?.status).toBe("unchanged");
    const removed = await planInstall({
      targets: ["claude"],
      projectDir: cwd,
      skills: [],
      agents: [],
      manifest: installed,
      prune: true,
    });
    expect(removed[0]?.deletions[0]?.kind).toBe("agent");
    await applyInstallPlans(removed, { manifest: installed });
    await expect(readFile(unrelated, "utf8")).resolves.toBe("user owned\n");
  });

  it("accepts legacy skill/MCP/hook manifests without agent entries", () => {
    expect(
      parseInstallManifest({
        version: 1,
        entries: [
          {
            kind: "skill",
            path: ".agents/skills/x/SKILL.md",
            skill: "x",
            targets: ["codex"],
            hash: "0".repeat(64),
          },
        ],
      }).entries,
    ).toHaveLength(1);
  });
});
