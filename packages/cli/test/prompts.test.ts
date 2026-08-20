import { builtInPacks, builtInSkillRegistry } from "@agentyx/core";
import { describe, expect, it } from "vitest";
import {
  mcpOptions,
  packOptions,
  skillNamesForPacks,
  skillOptions,
  targetOptions,
} from "../src/prompts.js";

describe("skillNamesForPacks", () => {
  it("returns every skill when no pack narrows the list", () => {
    expect(skillNamesForPacks([])).toEqual(builtInSkillRegistry.names);
  });

  it("returns only the skills the given packs contribute", () => {
    expect(skillNamesForPacks(["typescript"])).toEqual([
      "typescript-strict",
      "typescript-modeling",
      "typescript-modern",
    ]);
  });

  it("deduplicates skills two packs share", () => {
    const names = skillNamesForPacks(["typescript", "angular"]);

    expect(new Set(names).size).toBe(names.length);
  });

  it("ignores a pack that contributes nothing to this registry", () => {
    expect(skillNamesForPacks(["not-a-pack"])).toEqual([]);
  });
});

describe("prompt options", () => {
  /**
   * Descriptions are the reason the searchable lists are usable: clack's
   * default filter matches label, value and hint, so a hint is what makes
   * "browser" find `playwright` and "flaky" find `flaky-tests`.
   */
  it("hints every skill with its own description", () => {
    const options = skillOptions(["flaky-tests"]);

    expect(options[0]?.hint).toBe(builtInSkillRegistry.get("flaky-tests").description);
  });

  it("hints every pack with its own description", () => {
    const options = packOptions();

    for (const pack of builtInPacks) {
      expect(options.find((option) => option.value === pack.name)?.hint).toBe(pack.description);
    }
  });

  it("hints every MCP server with its transport, cost and description", () => {
    expect(mcpOptions().find((option) => option.value === "playwright")?.hint).toContain("stdio");
  });

  it("marks the targets detected in the project and leaves the rest unmarked", () => {
    const options = targetOptions(["claude"]);

    expect(options.find((option) => option.value === "claude")?.hint).toBe(
      "detected in this project",
    );
    expect(options.find((option) => option.value === "codex")?.hint).toBeUndefined();
  });

  it("offers every target regardless of what was detected", () => {
    expect(targetOptions().map((option) => option.value)).toEqual(["codex", "claude", "kimi"]);
  });
});
