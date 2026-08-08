import { InvalidSkillError } from "./errors.js";
import {
  type SkillDefinition,
  type SkillDefinitionInput,
  skillDefinitionSchema,
  skillMetadataSchema,
} from "./schema.js";

const DELIMITER = "---";
const BYTE_ORDER_MARK = /^\uFEFF/;
const LINE_BREAK = /[\r\n]/;

/**
 * A `SKILL.md` file is a frontmatter block followed by the Markdown body:
 *
 * ```md
 * ---
 * name: planning
 * description: Plan non-trivial work before editing.
 * ---
 *
 * Instructions...
 * ```
 *
 * The frontmatter is a deliberately small YAML subset — a flat block of
 * `key: value` pairs, values optionally quoted — so that core keeps depending
 * on Zod alone. Anything richer is rejected rather than guessed at.
 *
 * The body is preserved as written apart from trimming the blank lines around
 * it, and `origin` is only used to make errors readable.
 *
 * @throws {InvalidSkillError} when the frontmatter or the resulting skill is invalid.
 */
export function parseSkillMarkdown(markdown: string, origin: string): SkillDefinition {
  const lines = markdown.replace(BYTE_ORDER_MARK, "").split(/\r?\n/);

  if (lines[0]?.trim() !== DELIMITER) {
    throw new InvalidSkillError(
      origin,
      `the file must start with a "${DELIMITER}" frontmatter line`,
    );
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === DELIMITER);

  if (closing === -1) {
    throw new InvalidSkillError(
      origin,
      `the frontmatter block is never closed with "${DELIMITER}"`,
    );
  }

  const metadata = skillMetadataSchema.safeParse(parseFrontmatter(lines.slice(1, closing), origin));

  if (!metadata.success) {
    throw new InvalidSkillError(origin, metadata.error);
  }

  const skill = skillDefinitionSchema.safeParse({
    ...metadata.data,
    content: lines.slice(closing + 1).join("\n"),
  });

  if (!skill.success) {
    throw new InvalidSkillError(origin, skill.error);
  }

  return skill.data;
}

/**
 * Renders a skill as canonical `SKILL.md` text — the inverse of
 * `parseSkillMarkdown`, and the single representation every consumer installs.
 *
 * Keeping this in core is what stops a provider from owning a copy of a skill
 * body: an adapter decides *where* a skill goes, never what it says.
 *
 * The output is deterministic. Frontmatter is always `name` then `description`,
 * the body is the trimmed content, and the file ends with exactly one newline,
 * so re-rendering an unchanged skill produces a byte-identical file and an
 * installer can compare content instead of guessing.
 *
 * @throws {InvalidSkillError} when the definition is invalid, or when the
 * description cannot be represented in the flat frontmatter subset the parser
 * accepts.
 */
export function formatSkillMarkdown(skill: SkillDefinitionInput): string {
  const origin = typeof skill.name === "string" ? `skill "${skill.name}"` : "skill definition";
  const parsed = skillDefinitionSchema.safeParse(skill);

  if (!parsed.success) {
    throw new InvalidSkillError(origin, parsed.error);
  }

  const { name, description, content } = parsed.data;

  if (LINE_BREAK.test(description)) {
    throw new InvalidSkillError(origin, "the description must not contain a line break");
  }

  return `${DELIMITER}\nname: ${name}\ndescription: ${description}\n${DELIMITER}\n\n${content}\n`;
}

function parseFrontmatter(lines: readonly string[], origin: string): Record<string, string> {
  const entries = new Map<string, string>();

  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") {
      continue;
    }

    const separator = line.indexOf(":");
    // +2: the opening delimiter line, plus the shift from a zero-based index.
    const lineNumber = index + 2;

    if (separator === -1) {
      throw new InvalidSkillError(
        origin,
        `frontmatter line ${lineNumber} is not "key: value": ${line}`,
      );
    }

    const key = line.slice(0, separator).trim();

    if (key === "") {
      throw new InvalidSkillError(origin, `frontmatter line ${lineNumber} has an empty key`);
    }

    if (entries.has(key)) {
      throw new InvalidSkillError(
        origin,
        `duplicate frontmatter key "${key}" on line ${lineNumber}`,
      );
    }

    entries.set(key, unquote(line.slice(separator + 1).trim()));
  }

  return Object.fromEntries(entries);
}

function unquote(value: string): string {
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);

  return quoted?.[1] ?? quoted?.[2] ?? value;
}
