---
name: context-efficient-development
description: Develop Agentyx with targeted exploration, narrow iteration commands, concise output, and full verification before handoff.
---

# Context-efficient Agentyx development

Use this skill for non-trivial work on Agentyx itself. It is a repository-development skill, not a
built-in Agentyx product skill.

For broad exploration, noisy command loops, or MCP-heavy work, also read
`.agents/skills/repo-ai-tooling/SKILL.md`. For the official website, also read
`.agents/skills/official-website-development/SKILL.md`.

## Exploration

Start with targeted discovery. Search for names, commands, schemas, tests or nearby files before
opening broad ranges. Inspect package-local code first, then widen only when the change crosses
boundaries. Read full files when ownership or invariants are unclear; otherwise read relevant
symbols and ranges. Avoid re-reading files whose role is already understood.

## Commands

During iteration, prefer the smallest command that exercises the touched surface:

```sh
pnpm vitest run packages/adapters
pnpm vitest run packages/cli/test/install-command.test.ts
pnpm --filter @agentyx/core run build
pnpm typecheck
```

Do not run `pnpm check` after every small edit. Run focused tests while shaping the change, then run
the complete required gate before handoff or earlier when cross-package impact makes it useful.
If `rtk` is available, use it for commands likely to produce noisy output, while preserving raw
failure details when diagnostics matter.

## Output

Keep command output cheap. Prefer failing tests, targeted diagnostics, short `git diff --stat`, and
focused `rg` results. Do not paste long successful logs back into the conversation unless the user
asked for them.

## Planning

Skip large plans for trivial edits. For substantial work, establish scope, identify touched
packages, and make the smallest justified change. Do not introduce broad abstractions to save a few
lines.

## Context

Do not preload every Skill or MCP definition. Read task-relevant Skills only. Use MCP only when its
capability is required for the current job.
Use codebase-memory MCP, when configured, to orient around package ownership and prior decisions
before opening many files. Treat memory as a map, then verify in source.

## Verification

Efficiency never means skipping necessary verification. Iterate narrowly, then complete the
repository's required verification flow before handing work back.
