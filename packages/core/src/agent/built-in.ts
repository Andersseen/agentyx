import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_AGENTS_PATH } from "../assets.js";
import { createAgentRegistry } from "./registry.js";
import type { AgentDefinition } from "./schema.js";

export const builtInAgentNames = [
  "agentyx-planner",
  "agentyx-reviewer",
  "agentyx-verifier",
] as const;
export const builtInAgentRegistry = createAgentRegistry(
  builtInAgentNames.map((name) => ({
    name,
    load: () =>
      JSON.parse(
        readFileSync(join(BUILT_IN_AGENTS_PATH, `${name}.json`), "utf8"),
      ) as AgentDefinition,
  })),
);
