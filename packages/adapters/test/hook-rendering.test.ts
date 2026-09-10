import { builtInHookRegistry } from "@agentyx/core";
import { describe, expect, it } from "vitest";
import { ProviderConfigParseError } from "../src/errors.js";
import { renderClaudeHooksConfig } from "../src/hook-rendering.js";

const bootstrap = builtInHookRegistry.get("session-doctor-bootstrap");

describe("Claude Code hook rendering", () => {
  it("preserves unrelated settings while adding a SessionStart hook", () => {
    const existing = JSON.stringify({
      permissions: { allow: ["Bash(git status:*)"] },
      hooks: {
        PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "format" }] }],
      },
    });

    const { content, empty } = renderClaudeHooksConfig([bootstrap], {
      content: existing,
      remove: [],
    });
    const parsed = JSON.parse(content);

    expect(empty).toBe(false);
    expect(parsed.permissions).toEqual({ allow: ["Bash(git status:*)"] });
    expect(parsed.hooks.PostToolUse).toEqual([
      { matcher: "Write", hooks: [{ type: "command", command: "format" }] },
    ]);
    expect(parsed.hooks.SessionStart).toEqual([
      {
        matcher: "startup",
        hooks: [
          {
            type: "command",
            command: "npx",
            args: ["agentyx", "doctor", "--hook"],
            statusMessage: "agentyx:session-doctor-bootstrap",
          },
        ],
      },
    ]);
  });

  it("is idempotent: rendering twice never duplicates the entry", () => {
    const first = renderClaudeHooksConfig([bootstrap], { content: undefined, remove: [] });
    const second = renderClaudeHooksConfig([bootstrap], { content: first.content, remove: [] });

    expect(JSON.parse(second.content)).toEqual(JSON.parse(first.content));
  });

  it("removes only the named hook, leaving unrelated SessionStart entries alone", () => {
    const existing = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              { type: "command", command: "echo", args: ["hi"] },
              {
                type: "command",
                command: "npx",
                args: ["agentyx", "doctor", "--hook"],
                statusMessage: "agentyx:session-doctor-bootstrap",
              },
            ],
          },
        ],
      },
    });

    const { content } = renderClaudeHooksConfig([], {
      content: existing,
      remove: ["session-doctor-bootstrap"],
    });
    const parsed = JSON.parse(content);

    expect(parsed.hooks.SessionStart).toEqual([
      { matcher: "startup", hooks: [{ type: "command", command: "echo", args: ["hi"] }] },
    ]);
  });

  it("reports empty once every Agentyx entry and group is gone", () => {
    const existing = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: "npx",
                args: ["agentyx", "doctor", "--hook"],
                statusMessage: "agentyx:session-doctor-bootstrap",
              },
            ],
          },
        ],
      },
    });

    const { content, empty } = renderClaudeHooksConfig([], {
      content: existing,
      remove: ["session-doctor-bootstrap"],
    });

    expect(empty).toBe(true);
    expect(JSON.parse(content)).toEqual({});
  });

  it("does not silently repair a malformed hooks section", () => {
    expect(() =>
      renderClaudeHooksConfig([bootstrap], {
        content: JSON.stringify({ hooks: [] }),
        remove: [],
      }),
    ).toThrow(ProviderConfigParseError);
    expect(() =>
      renderClaudeHooksConfig([bootstrap], {
        content: JSON.stringify({ hooks: { SessionStart: {} } }),
        remove: [],
      }),
    ).toThrow(ProviderConfigParseError);
  });
});
