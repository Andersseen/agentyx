---
title: Observability
description: What doctor measures, what the percentages actually mean, and why "no observed use" is never reported as "unused".
group: Guides
order: 10
---

`agentyx doctor` answers a practical question: is the harness you configured actually useful, or have
you piled up capabilities you rarely use?

```bash
pnpm dlx @agentyx/cli doctor
pnpm dlx @agentyx/cli doctor --json
pnpm dlx @agentyx/cli doctor --check   # exit 1 on warnings or errors
```

## Three kinds of evidence

**Footprint, always.** From configuration alone, doctor reports how many packs, Skills, MCP servers,
local tools and hooks are active, and how many active MCP servers are low, medium or high *context
cost*. Those are the qualitative `contextCost` labels each MCP server declares — they are never added
up into a token figure. A capability two packs both contribute counts once.

**Pack breadth.** Configured packs are compared with what project detection recommends. This is
informational: packs such as `security`, `documentation` or `efficiency` are often deliberate workflow
choices that a `package.json` cannot reveal.

**Observed activity, when a provider can show it.** With the `efficiency` pack, Agentyx installs
small project-local hooks that run `agentyx hook observe`. Each records *that* a session started or
ended and *which* Agentyx Skill or MCP server was used. Repeated hooks are silent and fail open.

## What the numbers mean

`observed in 9 / 12 observable sessions (75%)` is an **observed session rate**: sessions where
Agentyx saw activity for a capability, divided by sessions that gave it enough telemetry to see it.

It is **not** a token, cost or context-window share, and not a measure of usefulness. Every JSON
percentage carries its numerator and denominator.

## The honesty rule

> [!IMPORTANT]
> "No observed use" is not "unused". A capability a provider cannot reliably show is **unobservable**,
> never dormant.

That distinction drives the flags in each adapter's `capabilities.observability`:

| Signal | Codex | Claude Code | Kimi Code | Qwen Code |
| --- | --- | --- | --- | --- |
| Session lifecycle | yes | yes | no | yes |
| Tool use | yes | yes | no | yes |
| Skill use | no | yes | no | no |
| MCP use | yes | yes | no | yes |
| Context size | no | yes, on resume or fork only | no | no |

Two of those are worth explaining, because both look like missing features and are deliberate:

- **Codex** documents no Skill usage signal, so Skill activity cannot be observed at all.
- **Qwen Code** documents no `Skill` tool, so a Skill the model selects on its own produces no hook
  payload. Only an explicitly typed `/skill` fires `UserPromptExpansion`. Counting just that half
  would report every model-selected use as "no observed use", so Agentyx declares Skill use
  unobservable and does not register the event.
- **Kimi Code** supports hooks, but only in user-level config. Agentyx never writes under `$HOME`, so
  nothing is observable — a policy limit, not a provider limit.

## Baselines

Doctor recommendations must never combine sessions from incompatible harness baselines. Only sessions
stamped with the current *installed* baseline reach a denominator, so enabling a new capability does
not retroactively make old sessions count as evidence against it. The baseline fingerprint covers
Agentyx capability names, target ids and provider observability flags — never paths, environment
values, timestamps, provider session ids or project content.

`doctor --json` reports how many historical sessions were ignored for this reason.

## What is stored

Observation state is metadata only, and local:

- It lives at `<git dir>/agentyx/usage-v2.jsonl`. The real git directory is resolved for worktrees and
  submodules.
- Git ignores it, so `git status` stays clean and your `.gitignore` is untouched.
- Outside a Git checkout nothing is recorded. Agentyx never writes to `$HOME`.
- It keeps the 50 most recent sessions and at most 256 KiB.

It holds a provider session id hash, an event, an Agentyx Skill or MCP id, a session-start baseline
fingerprint and — when a provider reports it — a context size. It never holds prompts, responses,
source code, file names, tool arguments or output, shell commands, secrets or environment variables;
the schema has nowhere to put them.

Skill use is recorded for Agentyx's built-in Skills only. Tools that run through shell commands, such
as RTK, are not observed, because Agentyx will not store or guess at command lines.

## Readiness is separate

Doctor's `readiness` section independently reports `configuration`, `installation` and
`localPrerequisites` as `ready`, `not-ready` or `unknown`.

It can inspect active local executable presence, referenced environment-variable names, and provider
MCP scope and transport compatibility. It does not launch MCP commands, load `.env` files, make network
requests, test registry downloads, or claim connectivity, authentication, authorization, provider
approval or semantic correctness. Finding `npx` proves only that the launcher is present; it does not
prove the MCP package is installed or that the server will start.
