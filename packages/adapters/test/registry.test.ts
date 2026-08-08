import { AgnoxError } from "@agnox/core";
import { describe, expect, it } from "vitest";
import type { AgentAdapter } from "../src/adapter.js";
import { builtInAdapterRegistry, builtInAdapters } from "../src/built-in.js";
import { DuplicateAdapterError, UnknownAdapterError } from "../src/errors.js";
import { createAdapterRegistry } from "../src/registry.js";

const fakeAdapter = (id: string): AgentAdapter => ({
  id,
  name: id,
  capabilities: { skills: true, mcp: { project: false, global: false } },
  skillsPath: (projectDir) => projectDir,
  detect: async (projectDir) => ({ target: id, skillsPath: projectDir, present: false }),
  planFiles: () => [],
});

describe("builtInAdapterRegistry", () => {
  it("lists codex, claude and kimi, in that order", () => {
    expect(builtInAdapterRegistry.ids).toEqual(["codex", "claude", "kimi"]);
  });

  it("retrieves a known adapter", () => {
    const codex = builtInAdapterRegistry.get("codex");

    expect(codex.id).toBe("codex");
    expect(codex.name).toBe("Codex");
    expect(builtInAdapterRegistry.get("claude").name).toBe("Claude Code");
    expect(builtInAdapterRegistry.get("kimi").name).toBe("Kimi Code");
  });

  it("answers has() without loading anything", () => {
    expect(builtInAdapterRegistry.has("codex")).toBe(true);
    expect(builtInAdapterRegistry.has("kimi")).toBe(true);
    expect(builtInAdapterRegistry.has("opencode")).toBe(false);
  });

  it("lists the adapters themselves", () => {
    expect(builtInAdapterRegistry.list()).toEqual(builtInAdapters);
  });

  it("fails on an unknown target with a domain error", () => {
    expect(() => builtInAdapterRegistry.get("opencode")).toThrow(UnknownAdapterError);
    expect(() => builtInAdapterRegistry.get("opencode")).toThrow(
      'Unknown target "opencode". Known targets: claude, codex, kimi.',
    );

    try {
      builtInAdapterRegistry.get("opencode");
      expect.unreachable("expected an UnknownAdapterError");
    } catch (error) {
      expect(error).toBeInstanceOf(AgnoxError);
      expect((error as UnknownAdapterError).code).toBe("unknown_adapter");
      expect((error as UnknownAdapterError).target).toBe("opencode");
    }
  });

  it("names no provider in the type or content of a skill", () => {
    // The adapters carry an id, a name and a directory — never instructions.
    for (const adapter of builtInAdapters) {
      expect(Object.keys(adapter).sort()).toEqual([
        "capabilities",
        "detect",
        "id",
        "mcpConfigPath",
        "name",
        "planFiles",
        "planMcpConfig",
        "references",
        "skillsPath",
      ]);
    }
  });
});

describe("createAdapterRegistry", () => {
  it("accepts third-party adapters", () => {
    const registry = createAdapterRegistry([fakeAdapter("acme")]);

    expect(registry.ids).toEqual(["acme"]);
    expect(registry.get("acme").id).toBe("acme");
  });

  it("rejects duplicate ids", () => {
    expect(() => createAdapterRegistry([fakeAdapter("acme"), fakeAdapter("acme")])).toThrow(
      DuplicateAdapterError,
    );
  });

  it("keeps registries independent", () => {
    const registry = createAdapterRegistry([fakeAdapter("acme")]);

    expect(registry.has("codex")).toBe(false);
    expect(builtInAdapterRegistry.has("acme")).toBe(false);
  });
});
