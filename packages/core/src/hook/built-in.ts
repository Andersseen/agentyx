import { createHookRegistry, type HookSource } from "./registry.js";

/**
 * The harness observer: `agentyx hook observe` reads the provider's hook JSON on stdin, keeps a few
 * metadata fields (never prompts, tool arguments or tool output), appends them to project-local
 * Git metadata and prints nothing. It exits 0 whatever happens, so it can never break a session.
 * The `{provider}` placeholder is filled in by each adapter. Like the doctor hook, it needs
 * `@agentyx/cli` as a project dependency and never reaches the network.
 */
function observerHook(
  name: string,
  event: "SessionStart" | "SessionEnd" | "PostToolUse",
  description: string,
  options: { readonly matcher: string; readonly async?: boolean; readonly timeout?: number },
): HookSource {
  return {
    name,
    load: () => ({
      name,
      description,
      event,
      command: "npx",
      args: ["--no-install", "agentyx", "hook", "observe", "--provider", "{provider}"],
      ...options,
    }),
  };
}

/**
 * The hooks Agentyx ships with.
 *
 * `session-doctor-bootstrap` runs `agentyx doctor --hook` on session start: silent when the project
 * is healthy, one short line otherwise.
 *
 * The runtime contract this depends on is explicit, not assumed:
 *
 * - The command name is `agentyx` — the `bin` entry `@agentyx/cli` publishes — never a bare package
 *   name for `npx` to fall back to. There is no npm package literally named `agentyx`, so if the
 *   fallback ever triggered it would look up the wrong package entirely.
 * - `--no-install` makes that fallback impossible: `npx` runs the project-local
 *   `node_modules/.bin/agentyx` when present and fails immediately otherwise, and never attempts a
 *   registry lookup or download of any kind. A persistent hook must not depend on implicit network
 *   access.
 * - This means a *persistent* hook requires `@agentyx/cli` to be an actual project dependency (for
 *   example `pnpm add -D @agentyx/cli`), not just invoked ad hoc through `pnpm dlx @agentyx/cli`,
 *   which never adds anything to the project. `doctor` (run directly, not through `--hook`) detects
 *   a missing local binary and reports it as `hook_runtime_unavailable` — see
 *   `packages/cli/src/commands/doctor.ts`. A missing binary makes the hook itself exit non-zero and
 *   print nothing useful, but it never blocks a session or performs a side effect beyond that.
 */
export const builtInHookSources: readonly HookSource[] = [
  {
    name: "session-doctor-bootstrap",
    load: () => ({
      name: "session-doctor-bootstrap",
      description: "Reports Agentyx project health at session start; silent when healthy.",
      event: "SessionStart",
      command: "npx",
      args: ["--no-install", "agentyx", "doctor", "--hook"],
    }),
  },
  observerHook("observe-session-start", "SessionStart", "Records that a session started.", {
    matcher: "*",
    async: true,
  }),
  observerHook("observe-session-end", "SessionEnd", "Records that a session ended.", {
    matcher: "*",
    timeout: 3,
  }),
  observerHook(
    "observe-tool-use",
    "PostToolUse",
    "Records which MCP servers and Skills were used.",
    { matcher: "mcp__.*|Skill", async: true },
  ),
];

export const builtInHookRegistry = createHookRegistry(builtInHookSources);

export const builtInHookNames: readonly string[] = builtInHookRegistry.names;
