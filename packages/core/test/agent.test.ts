import { describe, expect, it } from "vitest";
import {
  builtInAgentNames,
  builtInAgentRegistry,
  createAgentRegistry,
  mutateAgentyxConfig,
  parseAgentyxConfig,
  resolveAgentyxConfig,
} from "../src/index.js";

describe("built-in agents", () => {
  it("validates stable names and rejects duplicate registry entries", () => {
    const source = {
      name: "agentyx-demo",
      load: () => ({
        name: "agentyx-demo",
        description: "Demo",
        instructions: "Do work.",
        access: "read-only" as const,
      }),
    };
    expect(createAgentRegistry([source]).names).toEqual(["agentyx-demo"]);
    expect(() => createAgentRegistry([source, source])).toThrow(/Duplicate agent definition/);
    expect(() => createAgentRegistry([{ ...source, name: "Bad Name" }])).toThrow(/Invalid agent/);
  });

  it("loads three validated provider-neutral role definitions", () => {
    expect(builtInAgentNames).toEqual(["agentyx-planner", "agentyx-reviewer", "agentyx-verifier"]);
    for (const name of builtInAgentNames) {
      const agent = builtInAgentRegistry.get(name);
      expect(agent.instructions.length).toBeGreaterThan(0);
      expect(agent.description.length).toBeGreaterThan(0);
    }
    expect(builtInAgentRegistry.get("agentyx-planner").access).toBe("read-only");
    expect(builtInAgentRegistry.get("agentyx-reviewer").access).toBe("read-only");
  });

  it("declares agentic roles as optional and activates only explicitly enabled roles", () => {
    const disabled = resolveAgentyxConfig(parseAgentyxConfig({ packs: ["agentic"] }));
    expect(disabled.declaredAgents.map(({ name, activation }) => [name, activation])).toEqual(
      builtInAgentNames.map((name) => [name, "optional"]),
    );
    expect(disabled.agents).toEqual([]);
    const enabled = resolveAgentyxConfig(
      parseAgentyxConfig({ packs: ["agentic"], enable: ["agentyx-reviewer"] }),
    );
    expect(enabled.agents).toEqual(["agentyx-reviewer"]);
  });

  it("orphans an enabled agent when its contributing pack is removed", () => {
    const config = parseAgentyxConfig({ packs: ["agentic"], enable: ["agentyx-reviewer"] });
    const result = mutateAgentyxConfig(config, { removePacks: ["agentic"] });
    expect(result.config.enable).toEqual([]);
    expect(result.changes.capabilities.orphaned).toEqual(["agentyx-reviewer"]);
  });
});
