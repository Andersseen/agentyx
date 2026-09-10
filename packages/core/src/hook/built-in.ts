import { createHookRegistry, type HookSource } from "./registry.js";

/**
 * The hooks Agentyx ships with.
 *
 * `session-doctor-bootstrap` runs `agentyx doctor --hook` on session start:
 * silent when the project is healthy, one short line otherwise. `npx` (no
 * `-y`) resolves the project-local `agentyx` binary without ever falling back
 * to a network install — Agentyx never assumes network access, and a project
 * that resolves hooks through the `efficiency` pack already depends on
 * Agentyx being installed.
 */
export const builtInHookSources: readonly HookSource[] = [
  {
    name: "session-doctor-bootstrap",
    load: () => ({
      name: "session-doctor-bootstrap",
      description: "Reports Agentyx project health at session start; silent when healthy.",
      event: "SessionStart",
      command: "npx",
      args: ["agentyx", "doctor", "--hook"],
    }),
  },
];

export const builtInHookRegistry = createHookRegistry(builtInHookSources);

export const builtInHookNames: readonly string[] = builtInHookRegistry.names;
