import { describe, expect, it } from "vitest";
import { parseAgentyxConfig } from "../src/config/loader.js";
import { AgentyxConfigMutationError, mutateAgentyxConfig } from "../src/config/mutate.js";
import { resolveAgentyxConfig } from "../src/config/resolver.js";
import { UnknownPackError } from "../src/pack/errors.js";
import { createPackRegistry } from "../src/pack/registry.js";

describe("mutateAgentyxConfig", () => {
  it("adds and removes values in stable order without mutating the input", () => {
    const config = parseAgentyxConfig({
      packs: ["technical", "testing"],
      enable: ["playwright"],
      targets: ["codex"],
    });
    const result = mutateAgentyxConfig(config, {
      addPacks: ["efficiency", "technical"],
      removePacks: ["testing"],
      enable: ["rtk", "rtk"],
      addTargets: ["claude", "claude"],
      removeTargets: ["codex"],
    });

    expect(result.config.packs).toEqual(["technical", "efficiency"]);
    expect(result.config.enable).toEqual(["rtk"]);
    expect(result.config.targets).toEqual(["claude"]);
    expect(result.changes.capabilities.orphaned).toEqual(["playwright"]);
    expect(config.packs).toEqual(["technical", "testing"]);
    expect(config.enable).toEqual(["playwright"]);
  });

  it("preserves every unrelated configuration section and project context skill resolution", () => {
    const input = {
      $schema: "https://example.test/agentyx.schema.json",
      packs: ["technical"],
      enable: [],
      targets: ["codex"],
      skillDirectories: ["skills"],
      localPacks: [{ name: "local", skills: ["local-skill"] }],
      trustedSources: [
        { name: "anthropic-skills", path: "vendor/anthropic-skills", ref: "abc123" },
      ],
      project: {
        id: "sample",
        name: "Sample",
        docs: ["https://example.test/docs"],
        mcp: [],
        owns: [],
      },
      relations: [
        {
          id: "dependency",
          name: "Dependency",
          type: "uses",
          role: "runtime",
          docs: [],
          mcp: [],
          owns: [],
          guidance: [],
        },
      ],
      context: {
        commands: { test: { command: "pnpm test", cwd: "." } },
        areas: [{ path: "src", purpose: "Application source" }],
        constraints: ["Keep APIs stable"],
      },
    };
    const config = parseAgentyxConfig(input);
    const result = mutateAgentyxConfig(config, { addTargets: ["claude"] });

    expect(result.config).toMatchObject({ ...input, targets: ["codex", "claude"] });
    expect(resolveAgentyxConfig(result.config).skills).toContain("agentyx-project-context");
  });

  it("uses local pack definitions as optional capability provenance", () => {
    const config = parseAgentyxConfig({
      packs: [],
      enable: [],
      targets: [],
      localPacks: [
        {
          name: "custom-tools",
          skills: [],
          mcpServers: [{ name: "playwright", activation: "optional" }],
        },
      ],
    });
    const registry = createPackRegistry([
      {
        name: "custom-tools",
        skills: [],
        mcpServers: [{ name: "playwright", activation: "optional" }],
      },
    ]);

    expect(
      mutateAgentyxConfig(config, { addPacks: ["custom-tools"], enable: ["playwright"] }, registry)
        .config.enable,
    ).toEqual(["playwright"]);
  });

  it("rejects contradictory operations and unavailable optional capabilities", () => {
    const config = parseAgentyxConfig({ packs: ["testing"], enable: ["playwright"], targets: [] });
    expect(() =>
      mutateAgentyxConfig(config, { addPacks: ["testing"], removePacks: ["testing"] }),
    ).toThrowError(AgentyxConfigMutationError);
    expect(() =>
      mutateAgentyxConfig(config, { enable: ["playwright"], disable: ["playwright"] }),
    ).toThrowError(AgentyxConfigMutationError);
    expect(() =>
      mutateAgentyxConfig(config, { addTargets: ["kimi"], removeTargets: ["kimi"] }),
    ).toThrowError(AgentyxConfigMutationError);
    expect(() =>
      mutateAgentyxConfig(config, { removePacks: ["testing"], enable: ["playwright"] }),
    ).toThrowError(/not declared/);
    expect(() => mutateAgentyxConfig(config, { addPacks: ["missing"] })).toThrowError(
      UnknownPackError,
    );
  });

  it("treats duplicate adds and missing removes as deterministic no-ops", () => {
    const config = parseAgentyxConfig({ packs: ["technical"], targets: ["codex"] });
    const result = mutateAgentyxConfig(config, {
      addPacks: ["technical"],
      removePacks: ["testing"],
      removeTargets: ["kimi"],
    });
    expect(result.config.packs).toEqual(["technical"]);
    expect(result.config.targets).toEqual(["codex"]);
    expect(result.changes.packs.added).toEqual([]);
  });
});
