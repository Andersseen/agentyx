import {
  builtInMcpServerRegistry,
  builtInPackRegistry,
  builtInSkillNames,
  resolveAgentyxConfig,
} from "@agentyx/core";
import { describe, expect, it } from "vitest";
import { PACKS } from "../src/app/data/packs.js";
import {
  EXAMPLE_COMPOSITION,
  MCP_SERVER_COUNT,
  PACK_COUNT,
  SKILL_COUNT,
} from "../src/app/data/site.js";

describe("site facts", () => {
  it("matches the built-in registries", () => {
    expect(PACK_COUNT).toBe(builtInPackRegistry.size);
    expect(SKILL_COUNT).toBe(builtInSkillNames.length);
    expect(MCP_SERVER_COUNT).toBe(builtInMcpServerRegistry.names.length);
  });

  it("lists every pack with its real Skills", () => {
    expect(PACKS.map((pack) => pack.name)).toEqual([...builtInPackRegistry.keys()]);

    for (const pack of PACKS) {
      const registered = builtInPackRegistry.get(pack.name);

      expect(pack.category, pack.name).toBe(registered?.category);
      expect(pack.skills, pack.name).toEqual(registered?.skills);
    }
  });

  it("reports the real result of the example composition", () => {
    const resolved = resolveAgentyxConfig({
      packs: [...EXAMPLE_COMPOSITION.packs],
      enable: [...EXAMPLE_COMPOSITION.enable],
      targets: [],
    });

    expect(resolved.skills).toHaveLength(EXAMPLE_COMPOSITION.skills);
    expect(resolved.mcpServers).toHaveLength(EXAMPLE_COMPOSITION.mcpServers);
  });
});
