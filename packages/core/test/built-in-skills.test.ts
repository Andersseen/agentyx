import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUILT_IN_SKILLS_PATH } from "../src/assets.js";
import {
  builtInSkillNames,
  builtInSkillPath,
  builtInSkillRegistry,
} from "../src/skill/built-in.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

describe("built-in skill assets", () => {
  it("resolves the skills directory inside the package", () => {
    expect(BUILT_IN_SKILLS_PATH).toBe(join(packageRoot, "skills"));
  });

  it("ships a SKILL.md for every built-in skill", () => {
    for (const name of builtInSkillNames) {
      expect(existsSync(builtInSkillPath(name)), `${name}/SKILL.md is missing`).toBe(true);
    }
  });

  it("publishes the skills directory", () => {
    const manifest: unknown = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    const files = (manifest as { files: readonly string[] }).files;

    expect(files).toContain("skills");
  });
});

describe("built-in skill registry", () => {
  it("ships exactly the documented skills", () => {
    expect(builtInSkillRegistry.names).toEqual([...builtInSkillNames]);
  });

  it("loads every built-in skill", () => {
    for (const name of builtInSkillNames) {
      const skill = builtInSkillRegistry.get(name);

      expect(skill.name).toBe(name);
      expect(skill.description).not.toBe("");
      expect(skill.content).not.toBe("");
    }
  });

  it("keeps skills concise", () => {
    for (const name of builtInSkillNames) {
      const words = builtInSkillRegistry.get(name).content.split(/\s+/).length;

      expect(words, `${name} has ${words} words`).toBeGreaterThan(30);
      expect(words, `${name} has ${words} words`).toBeLessThan(500);
    }
  });

  it("keeps skills provider agnostic", () => {
    for (const name of builtInSkillNames) {
      const skill = builtInSkillRegistry.get(name);

      expect(`${skill.description}\n${skill.content}`.toLowerCase()).not.toMatch(
        /\b(codex|claude|kimi|opencode|cursor|copilot)\b/,
      );
    }
  });

  it("fails on an unknown skill", () => {
    expect(() => builtInSkillRegistry.get("does-not-exist")).toThrow(/Unknown skill/);
  });
});
