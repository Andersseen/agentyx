import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtInHookRegistry } from "@agentyx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { builtInAdapterRegistry } from "../src/built-in.js";
import { normalizeClaudeHook, normalizeCodexHook } from "../src/hook-observer.js";
import { renderJsonHooksConfig } from "../src/hook-rendering.js";
import { planInstall } from "../src/planner.js";

const known = {
  mcpServers: new Set(["playwright", "chrome-devtools", "context7"]),
  skills: new Set(["angular-modern", "planning"]),
};
const observers = ["observe-session-start", "observe-session-end", "observe-tool-use"].map((name) =>
  builtInHookRegistry.get(name),
);
const bootstrap = builtInHookRegistry.get("session-doctor-bootstrap");

describe("hook rendering for observation", () => {
  it("renders Claude entries for several events, with Claude-only UserPromptExpansion inside the adapter", () => {
    const { content } = renderJsonHooksConfig("claude", "claude", [bootstrap, ...observers], {
      content: undefined,
      remove: [],
    });
    const hooks = JSON.parse(content).hooks;

    expect(Object.keys(hooks).sort()).toEqual([
      "PostToolUse",
      "SessionEnd",
      "SessionStart",
      "UserPromptExpansion",
    ]);
    expect(hooks.PostToolUse[0]).toEqual({
      matcher: "mcp__.*|Skill",
      hooks: [
        {
          type: "command",
          command: "npx",
          args: ["--no-install", "agentyx", "hook", "observe", "--provider", "claude"],
          statusMessage: "agentyx:observe-tool-use",
          async: true,
        },
      ],
    });
    expect(hooks.SessionEnd[0].hooks[0].timeout).toBe(3);
    // The doctor bootstrap keeps its "startup" matcher.
    expect(hooks.SessionStart.map((group: { matcher: string }) => group.matcher)).toEqual([
      "startup",
      "*",
    ]);
  });

  it("renders Codex entries as shell strings with the same ownership marker", () => {
    const { content } = renderJsonHooksConfig("codex", "codex", observers, {
      content: undefined,
      remove: [],
    });
    const hooks = JSON.parse(content).hooks;

    expect(Object.keys(hooks).sort()).toEqual(["PostToolUse", "SessionEnd", "SessionStart"]);
    expect(hooks.PostToolUse[0].hooks[0]).toMatchObject({
      type: "command",
      command: "npx --no-install agentyx hook observe --provider codex",
      statusMessage: "agentyx:observe-tool-use",
    });
    expect(hooks.PostToolUse[0].matcher).toBe("mcp__.*|Skill");
    expect(hooks.PostToolUse[0].hooks[0].args).toBeUndefined();
  });

  it.each(["claude", "codex"] as const)(
    "%s: preserves user hooks, is idempotent, removes only its own",
    (flavor) => {
      const user = {
        hooks: {
          PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "format" }] }],
          Stop: [{ hooks: [{ type: "command", command: "ding" }] }],
        },
        other: { keep: true },
      };
      const first = renderJsonHooksConfig(flavor, flavor, observers, {
        content: JSON.stringify(user),
        remove: [],
      });
      const second = renderJsonHooksConfig(flavor, flavor, observers, {
        content: first.content,
        remove: [],
      });

      expect(second.content).toBe(first.content);

      const removed = renderJsonHooksConfig(flavor, flavor, [], {
        content: first.content,
        remove: observers.map((hook) => hook.name),
      });

      expect(JSON.parse(removed.content)).toEqual(user);
      expect(removed.empty).toBe(false);
    },
  );

  it("reports empty once only Agentyx entries existed", () => {
    const installed = renderJsonHooksConfig("codex", "codex", observers, {
      content: undefined,
      remove: [],
    });

    expect(
      renderJsonHooksConfig("codex", "codex", [], { content: installed.content, remove: [] }).empty,
    ).toBe(true);
  });
});

describe("provider hook normalization", () => {
  it("normalizes Codex SessionStart, SessionEnd and MCP PostToolUse", () => {
    const base = { session_id: "abc", transcript_path: "/t", cwd: "/p", model: "m" };

    expect(
      normalizeCodexHook({ ...base, hook_event_name: "SessionStart", source: "startup" }, known),
    ).toEqual({ sessionId: "abc", event: "session-start" });
    expect(
      normalizeCodexHook({ ...base, hook_event_name: "SessionEnd", reason: "other" }, known),
    ).toEqual({ sessionId: "abc", event: "session-end" });
    expect(
      normalizeCodexHook(
        {
          ...base,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__chrome_devtools__take_snapshot",
          tool_input: { secret: "sk-123" },
          tool_response: "private",
        },
        known,
      ),
    ).toEqual({
      sessionId: "abc",
      event: "mcp-used",
      capabilityKind: "mcp",
      capability: "chrome-devtools",
    });
  });

  it("ignores unknown MCP servers, other tools and Skill tools for Codex", () => {
    const base = { session_id: "abc", hook_event_name: "PostToolUse" };

    expect(normalizeCodexHook({ ...base, tool_name: "mcp__acme__do" }, known)).toBeUndefined();
    expect(normalizeCodexHook({ ...base, tool_name: "Bash" }, known)).toBeUndefined();
    expect(
      normalizeCodexHook({ ...base, tool_name: "Skill", tool_input: { skill: "planning" } }, known),
    ).toBeUndefined();
  });

  it("rejects malformed payloads", () => {
    for (const payload of [null, "x", 1, [], {}, { session_id: 5 }, { session_id: "a" }]) {
      expect(normalizeCodexHook(payload, known)).toBeUndefined();
      expect(normalizeClaudeHook(payload, known)).toBeUndefined();
    }
  });

  it("normalizes Claude Skill tool use and direct slash Skills, keeping only the identifier", () => {
    const skillTool = normalizeClaudeHook(
      {
        session_id: "s",
        hook_event_name: "PostToolUse",
        tool_name: "Skill",
        tool_input: { skill: "planning", args: "my private prompt" },
      },
      known,
    );
    const slash = normalizeClaudeHook(
      {
        session_id: "s",
        hook_event_name: "UserPromptExpansion",
        expansion_type: "slash_command",
        command_name: "agentyx:angular-modern",
        command_args: "secret",
        prompt: "/angular-modern secret",
      },
      known,
    );

    expect(skillTool).toEqual({
      sessionId: "s",
      event: "skill-used",
      capabilityKind: "skill",
      capability: "planning",
    });
    expect(slash).toMatchObject({ event: "skill-used", capability: "angular-modern" });
    expect(JSON.stringify([skillTool, slash])).not.toMatch(/secret|private/);
    expect(
      normalizeClaudeHook(
        {
          session_id: "s",
          hook_event_name: "UserPromptExpansion",
          expansion_type: "slash_command",
          command_name: "my-command",
        },
        known,
      ),
    ).toBeUndefined();
  });

  it("keeps Claude's provider-reported context_tokens as an optional sample", () => {
    expect(
      normalizeClaudeHook(
        {
          session_id: "s",
          hook_event_name: "SessionStart",
          source: "resume",
          context_tokens: 182000,
        },
        known,
      ),
    ).toEqual({ sessionId: "s", event: "session-start", contextTokens: 182000 });
    expect(
      normalizeClaudeHook(
        { session_id: "s", hook_event_name: "SessionStart", context_tokens: "lots" },
        known,
      ),
    ).toEqual({ sessionId: "s", event: "session-start" });
  });
});

describe("provider observability declarations", () => {
  it("states what each provider documents, without the caller branching on ids", () => {
    const get = (id: string) => builtInAdapterRegistry.get(id).capabilities.observability;

    expect(get("claude")).toMatchObject({
      projectHooks: true,
      skillUse: true,
      mcpUse: true,
      contextTokens: true,
    });
    expect(get("codex")).toMatchObject({
      projectHooks: true,
      skillUse: false,
      mcpUse: true,
      contextTokens: false,
    });
    expect(get("kimi")).toMatchObject({
      projectHooks: false,
      sessionLifecycle: false,
      mcpUse: false,
    });
    expect(get("kimi")?.reason).toMatch(/supports hooks/);
    expect(get("kimi")?.reason).toMatch(/project-local/);
  });
});

describe("Codex project installation", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agentyx-codex-hooks-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const plan = () =>
    planInstall({
      targets: ["codex"],
      projectDir: dir,
      skills: [],
      hooks: observers,
      manifest: undefined,
      prune: false,
    } as never);

  it("creates .codex/hooks.json by default and nothing under $HOME", async () => {
    const [codex] = await plan();

    expect(codex?.hookOperations.map((operation) => operation.relativePath)).toEqual([
      ".codex/hooks.json",
    ]);
  });

  it("merges into an existing hooks.json", async () => {
    await mkdir(join(dir, ".codex"));
    await writeFile(
      join(dir, ".codex", "hooks.json"),
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "ding" }] }] } }),
    );

    const [codex] = await plan();
    const content = JSON.parse(codex?.hookOperations[0]?.content ?? "{}");

    expect(content.hooks.Stop).toHaveLength(1);
    expect(content.hooks.SessionStart).toHaveLength(1);
  });

  it("does not add a second hook source when config.toml already has inline hooks", async () => {
    await mkdir(join(dir, ".codex"));
    await writeFile(
      join(dir, ".codex", "config.toml"),
      '[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "ding"\n',
    );

    const [codex] = await plan();

    expect(codex?.hookOperations).toEqual([]);

    const status = await builtInAdapterRegistry.get("codex").inspectHooks?.(dir);

    expect(status).toMatchObject({ configured: false, trust: "review-may-be-required" });
    expect(status?.note).toMatch(/inline hooks/);
    await expect(readFile(join(dir, ".codex", "hooks.json"), "utf8")).rejects.toThrow();
  });
});
