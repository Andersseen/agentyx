/**
 * Regression tests for provider config entries Agentyx merges into user-owned files.
 *
 * Found in a real-project pilot: hand-editing the `context7` server Agentyx had added to `.mcp.json`
 * was silently replaced on the next sync while Doctor reported nothing edited. An entry someone else
 * wrote or edited is now a conflict; a definition Agentyx itself changed still updates.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  builtInHookRegistry,
  builtInMcpServerRegistry,
  hashCapabilityDefinition,
  type InstallManifest,
  loadInstallManifest,
  type McpServerDefinition,
} from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyInstallPlans } from "../src/executor.js";
import { collectInstallConflicts } from "../src/plan.js";
import { planInstall } from "../src/planner.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentyx-owned-entry-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const context7 = builtInMcpServerRegistry.get("context7");

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), content, "utf8");
}

const read = (path: string) => readFile(join(dir, path), "utf8");

async function sync(input: {
  readonly mcpServers?: readonly McpServerDefinition[];
  readonly hooks?: readonly string[];
  readonly manifest?: InstallManifest;
  readonly force?: boolean;
}) {
  const manifest = input.manifest ?? (await loadInstallManifest(dir));
  const plans = await planInstall({
    targets: ["claude"],
    projectDir: dir,
    skills: [],
    mcpServers: input.mcpServers ?? [],
    hooks: (input.hooks ?? []).map((name) => builtInHookRegistry.get(name)),
    manifest,
    prune: true,
    force: input.force === true,
  });
  await applyInstallPlans(plans, { manifest });
  return collectInstallConflicts(plans);
}

function snapshotWith(
  manifest: InstallManifest,
  mcpServers: readonly { readonly name: string; readonly hash: string }[],
): InstallManifest {
  return {
    version: 2,
    entries: manifest.entries,
    resolution: {
      agentyxVersion: "0.0.0-test",
      configHash: "0".repeat(64),
      targets: ["claude"],
      skills: [],
      mcpServers: mcpServers.map((server) => ({
        ...server,
        origins: [{ kind: "pack", name: "angular" }],
      })),
      tools: [],
      hooks: [],
      agents: [],
    },
  };
}

describe("owned provider config entries", () => {
  it("refuses to replace a same-named server the user wrote before Agentyx", async () => {
    const mine = `${JSON.stringify({ mcpServers: { context7: { url: "https://mine.test/mcp" } } }, null, 2)}\n`;
    await put(".mcp.json", mine);

    expect(await sync({ mcpServers: [context7] })).toEqual([".mcp.json"]);
    expect(await read(".mcp.json")).toBe(mine);
  });

  it("adopts a same-named server that already matches the definition", async () => {
    await sync({ mcpServers: [context7] });
    const written = await read(".mcp.json");
    await rm(join(dir, ".agentyx.lock.json"));

    expect(await sync({ mcpServers: [context7] })).toEqual([]);
    expect(await read(".mcp.json")).toBe(written);
  });

  it("keeps a reformatted file whose owned entry is unchanged in meaning", async () => {
    await sync({ mcpServers: [context7] });
    const reformatted = `${JSON.stringify(JSON.parse(await read(".mcp.json")), null, 4)}\n`;
    await put(".mcp.json", reformatted);

    expect(await sync({ mcpServers: [context7] })).toEqual([]);
  });

  it("updates an owned server whose definition changed since the snapshot", async () => {
    await sync({ mcpServers: [context7] });
    // The user adds a server of their own: the file no longer matches the recorded hash.
    const document = JSON.parse(await read(".mcp.json"));
    document.mcpServers.mine = { command: "mine" };
    await put(".mcp.json", `${JSON.stringify(document, null, 2)}\n`);
    const upgraded = { ...context7, url: "https://mcp.context7.com/v2/mcp" } as McpServerDefinition;
    const manifest = snapshotWith(await loadInstallManifest(dir), [
      { name: "context7", hash: hashCapabilityDefinition(context7) },
    ]);

    expect(await sync({ mcpServers: [upgraded], manifest })).toEqual([]);
    const servers = JSON.parse(await read(".mcp.json")).mcpServers;
    expect(servers.context7.url).toBe("https://mcp.context7.com/v2/mcp");
    expect(servers.mine).toEqual({ command: "mine" });
  });

  it("treats an edit to an owned server with an unchanged definition as a conflict", async () => {
    await sync({ mcpServers: [context7] });
    const document = JSON.parse(await read(".mcp.json"));
    document.mcpServers.context7.headers = { "X-Team": "local" };
    const edited = `${JSON.stringify(document, null, 2)}\n`;
    await put(".mcp.json", edited);
    const manifest = snapshotWith(await loadInstallManifest(dir), [
      { name: "context7", hash: hashCapabilityDefinition(context7) },
    ]);

    expect(await sync({ mcpServers: [context7], manifest })).toEqual([".mcp.json"]);
    expect(await read(".mcp.json")).toBe(edited);
  });

  it("treats an edit to an owned hook as a conflict until forced", async () => {
    await sync({ hooks: ["session-doctor-bootstrap"] });
    const original = await read(".claude/settings.json");
    const edited = original.replace("doctor", "doctor --verbose");
    expect(edited).not.toBe(original);
    await put(".claude/settings.json", edited);

    expect(await sync({ hooks: ["session-doctor-bootstrap"] })).toEqual([".claude/settings.json"]);
    expect(await read(".claude/settings.json")).toBe(edited);

    expect(await sync({ hooks: ["session-doctor-bootstrap"], force: true })).toEqual([]);
    expect(await read(".claude/settings.json")).toBe(original);
  });
});
