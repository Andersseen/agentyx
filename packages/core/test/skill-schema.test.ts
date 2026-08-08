import { describe, expect, it } from "vitest";
import { skillDefinitionSchema } from "../src/skill/schema.js";

const valid = {
  name: "typescript-modern",
  description: "Modern TypeScript development conventions.",
  content: "Keep strict on.",
};

describe("skillDefinitionSchema", () => {
  it("accepts a valid skill", () => {
    expect(skillDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a missing name", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, name: undefined })).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects a name that is not a lowercase slug", () => {
    for (const name of ["TypeScript", "typescript modern", "typescript_modern", "-leading"]) {
      expect(() => skillDefinitionSchema.parse({ ...valid, name })).toThrow(/kebab-case/);
    }
  });

  it("accepts digits in a name", () => {
    expect(skillDefinitionSchema.parse({ ...valid, name: "angular-20" }).name).toBe("angular-20");
  });

  it("rejects a missing description", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, description: undefined })).toThrow();
  });

  it("rejects an empty description", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, description: "   " })).toThrow(
      /description/,
    );
  });

  it("rejects empty content", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, content: "" })).toThrow(/content/);
  });

  it("rejects whitespace-only content", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, content: "\n  \n" })).toThrow(/content/);
  });

  it("normalises surrounding whitespace", () => {
    const skill = skillDefinitionSchema.parse({
      ...valid,
      description: "  Modern TypeScript development conventions.  ",
      content: "\n\nKeep strict on.\n\n",
    });

    expect(skill.description).toBe("Modern TypeScript development conventions.");
    expect(skill.content).toBe("Keep strict on.");
  });

  it("preserves whitespace inside the content", () => {
    const content = "# Title\n\n- one\n- two\n\n```ts\nconst a = 1;\n```";

    expect(skillDefinitionSchema.parse({ ...valid, content }).content).toBe(content);
  });

  it("rejects unknown fields", () => {
    expect(() => skillDefinitionSchema.parse({ ...valid, provider: "codex" })).toThrow();
  });
});
