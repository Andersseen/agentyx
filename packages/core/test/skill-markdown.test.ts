import { describe, expect, it } from "vitest";
import { InvalidSkillError } from "../src/skill/errors.js";
import { parseSkillMarkdown } from "../src/skill/markdown.js";

const validMarkdown = [
  "---",
  "name: planning",
  "description: Plan non-trivial work before editing.",
  "---",
  "",
  "# Planning",
  "",
  "Read before you edit.",
  "",
].join("\n");

describe("parseSkillMarkdown", () => {
  it("parses frontmatter and body", () => {
    expect(parseSkillMarkdown(validMarkdown, "SKILL.md")).toEqual({
      name: "planning",
      description: "Plan non-trivial work before editing.",
      content: "# Planning\n\nRead before you edit.",
    });
  });

  it("preserves Markdown structure inside the body", () => {
    const body = "## Heading\n\n- one\n- two\n\n```ts\nconst a = 1;\n```";
    const skill = parseSkillMarkdown(`---\nname: a\ndescription: A\n---\n\n${body}\n`, "SKILL.md");

    expect(skill.content).toBe(body);
  });

  it("accepts CRLF line endings", () => {
    expect(parseSkillMarkdown(validMarkdown.replace(/\n/g, "\r\n"), "SKILL.md").content).toBe(
      "# Planning\n\nRead before you edit.",
    );
  });

  it("accepts quoted values", () => {
    const skill = parseSkillMarkdown(
      ["---", 'name: "planning"', "description: 'Plan first.'", "---", "Body."].join("\n"),
      "SKILL.md",
    );

    expect(skill.name).toBe("planning");
    expect(skill.description).toBe("Plan first.");
  });

  it("keeps a colon inside a value", () => {
    const skill = parseSkillMarkdown(
      ["---", "name: planning", "description: Plan first: then edit.", "---", "Body."].join("\n"),
      "SKILL.md",
    );

    expect(skill.description).toBe("Plan first: then edit.");
  });

  it("names the origin in the error message", () => {
    expect(() => parseSkillMarkdown("no frontmatter", "skills/broken/SKILL.md")).toThrow(
      /skills\/broken\/SKILL\.md/,
    );
  });

  it("rejects a file without frontmatter", () => {
    expect(() => parseSkillMarkdown("# Planning\n", "SKILL.md")).toThrow(InvalidSkillError);
    expect(() => parseSkillMarkdown("# Planning\n", "SKILL.md")).toThrow(/must start with/);
  });

  it("rejects an unclosed frontmatter block", () => {
    expect(() => parseSkillMarkdown("---\nname: planning\n", "SKILL.md")).toThrow(/never closed/);
  });

  it("rejects a frontmatter line that is not a key-value pair", () => {
    expect(() => parseSkillMarkdown("---\nname: planning\nbroken\n---\nBody.", "SKILL.md")).toThrow(
      /line 3 is not "key: value"/,
    );
  });

  it("rejects a duplicate frontmatter key", () => {
    expect(() =>
      parseSkillMarkdown("---\nname: a\nname: b\ndescription: A\n---\nBody.", "SKILL.md"),
    ).toThrow(/duplicate frontmatter key "name"/);
  });

  it("rejects an empty frontmatter key", () => {
    expect(() => parseSkillMarkdown("---\n: value\n---\nBody.", "SKILL.md")).toThrow(/empty key/);
  });

  it("rejects missing metadata", () => {
    expect(() => parseSkillMarkdown("---\nname: planning\n---\nBody.", "SKILL.md")).toThrow(
      /description/,
    );
    expect(() => parseSkillMarkdown("---\ndescription: A\n---\nBody.", "SKILL.md")).toThrow(/name/);
  });

  it("rejects an unknown frontmatter key", () => {
    expect(() =>
      parseSkillMarkdown("---\nname: a\ndescription: A\nprovider: codex\n---\nBody.", "SKILL.md"),
    ).toThrow(InvalidSkillError);
  });

  it("rejects content supplied through frontmatter", () => {
    expect(() =>
      parseSkillMarkdown("---\nname: a\ndescription: A\ncontent: sneaky\n---\nBody.", "SKILL.md"),
    ).toThrow(InvalidSkillError);
  });

  it("rejects an empty body", () => {
    expect(() => parseSkillMarkdown("---\nname: a\ndescription: A\n---\n\n\n", "SKILL.md")).toThrow(
      /content/,
    );
  });

  it("ignores blank lines between frontmatter entries", () => {
    expect(
      parseSkillMarkdown("---\nname: a\n\ndescription: A\n---\nBody.", "SKILL.md").description,
    ).toBe("A");
  });

  it("exposes the origin on the error", () => {
    try {
      parseSkillMarkdown("broken", "skills/x/SKILL.md");
      expect.unreachable("expected an InvalidSkillError");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSkillError);
      expect((error as InvalidSkillError).origin).toBe("skills/x/SKILL.md");
      expect((error as InvalidSkillError).code).toBe("invalid_skill");
    }
  });
});
