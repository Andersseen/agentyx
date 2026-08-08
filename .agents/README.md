# Agent workflow skills

Skills for AI coding agents working **on this repository**. They are not Agnox product
configuration — Agnox does not generate or read anything in this directory.

Every skill here is provider-neutral: plain Markdown, no provider names, no tool names, no
assumption about which agent is reading it. Claude Code, Codex, Cursor, Copilot, Gemini CLI and
anything else that can read a file all get the same instructions.

## Layout

```
.agents/skills/<name>/SKILL.md
```

One directory per skill, `SKILL.md` inside it, YAML frontmatter with `name` and `description`, and
the Markdown body as the instructions — the same shape Agnox itself defines in
[packages/core/skills](../packages/core/skills). Nothing else is required to consume one: read the
file, follow the body.

- [verify-agnox](skills/verify-agnox/SKILL.md) — the full verification pipeline, including the CLI
  and schema checks `pnpm check` does not cover.
- [add-builtin-stack](skills/add-builtin-stack/SKILL.md) — add a stack to the built-in registry with
  the tests it needs.

[AGENTS.md](../AGENTS.md) lists the same two, so an agent that reads the repository's instruction
file finds the skills without knowing this directory exists.

## Provider bridges

Some agents have a native skill mechanism and only look in their own directory. Those get a **thin
bridge**: a file in the provider's location carrying the frontmatter it needs and a link back here.

Wired up today:

- **Claude Code** — `.claude/skills/<name>/SKILL.md`, which makes each skill available as `/<name>`.

To add another provider, write its bridge file in whatever location and format that provider
expects, and point it at `.agents/skills/<name>/SKILL.md`. Agents with no skill mechanism need no
bridge at all — AGENTS.md already tells them where to look.

Two rules keep this honest:

- **Instructions live here only.** A bridge links; it never copies. Duplicated instructions drift,
  and a drifted copy is worse than no skill.
- **No provider-specific content in a skill body.** If a step only makes sense for one agent, it
  belongs in that provider's own configuration ([CLAUDE.md](../CLAUDE.md) for Claude Code), not in
  `.agents/skills`.
