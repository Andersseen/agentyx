# Agent workflow skills

Skills for AI coding agents working **on this repository**. They are not Agentyx product
configuration — Agentyx does not generate or read anything in this directory.

Every skill here is provider-neutral: plain Markdown with no assumption about which agent is reading
it. A skill may mention repository tools such as RTK or codebase memory, but it must describe how to
use them generically and how to continue when they are unavailable. Claude Code, Codex, Cursor,
Copilot, Gemini CLI and anything else that can read a file all get the same instructions.

## Layout

```
.agents/skills/<name>/SKILL.md
```

One directory per skill, `SKILL.md` inside it, YAML frontmatter with `name` and `description`, and
the Markdown body as the instructions — the same shape Agentyx itself defines in
[packages/core/skills](../packages/core/skills). Nothing else is required to consume one: read the
file, follow the body.

- [verify-agentyx](skills/verify-agentyx/SKILL.md) — the full verification pipeline, including the CLI
  and schema checks `pnpm check` does not cover.
- [add-builtin-pack](skills/add-builtin-pack/SKILL.md) — add a pack to the built-in registry with
  the tests it needs.
- [context-efficient-development](skills/context-efficient-development/SKILL.md) — keep Agentyx
  development context, commands and output focused without weakening verification.
- [navigate-agentyx](skills/navigate-agentyx/SKILL.md) — quickly choose the right package or directory
  for a change.
- [repo-ai-tooling](skills/repo-ai-tooling/SKILL.md) — use repository AI tooling such as RTK and
  codebase memory in a provider-neutral, token-frugal way.
- [official-website-development](skills/official-website-development/SKILL.md) — build the official
  Agentyx website with grounded copy, bounded exploration and visual verification.

[AGENTS.md](../AGENTS.md) lists the same skills, so an agent that reads the repository's instruction
file finds the skills without knowing this directory exists.

## Provider bridges

Some agents have a native skill mechanism and only look in their own directory. Those get a **thin
bridge**: a file in the provider's location carrying the frontmatter it needs and a link back here.

Provider-native bridges are optional because Codex and Kimi Code both read this shared directory
directly. Wired up today:

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
