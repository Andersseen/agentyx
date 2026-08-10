---
name: repo-ai-tooling
description: Use Agentyx repository AI tooling in a provider-neutral, token-frugal way.
---

# Repository AI tooling

Use this skill when working on Agentyx itself, especially before broad exploration, website work,
or long verification loops. These instructions are provider-neutral: use the equivalent local tool
when your agent exposes one, and skip unavailable tools without blocking useful work.

## Context Budget

Start each substantial task with a small context budget:

- Identify the owning area before opening files.
- Search first, then read only the relevant ranges.
- Prefer one high-signal file over many low-signal files.
- Keep command output bounded and summarize only the lines that change the decision.
- Reuse earlier findings instead of rereading files unless they may have changed.

Escalate the budget only when the current evidence cannot answer the next decision.

## RTK

When `rtk` is installed, prefer it for commands that can produce noisy output:

```sh
rtk pnpm test
rtk pnpm check
rtk git diff
rtk rg "pattern"
```

Use the normal command when exact raw output matters, when RTK is unavailable, or when the command is
already tiny. For failures, preserve the real failing command, exit code, file path, and diagnostic.

## Codebase Memory

Use a codebase-memory MCP or equivalent persistent repo-memory tool as a map, not as authority.

Ask it for ownership, prior decisions, file clusters, and terminology before reading many files.
Then verify important claims in the repository. Update memory only with stable project facts such as
architecture decisions, package boundaries, or repeated workflows; do not store secrets, temporary
debug output, or guesses.

## MCP Discipline

Load MCP tools only when they reduce total context:

- Codebase memory for repo orientation and avoiding repeated full-tree reads.
- Documentation MCP for current framework or library details.
- Browser or Playwright MCP for visual website validation.

Do not keep heavy MCP context open for simple edits. If a tool returns a large result, narrow the
query and keep only the actionable facts.

## Reporting

Report compactly: what changed, what was verified, and any remaining risk. Include exact paths and
commands when they matter. Avoid replaying successful logs.
