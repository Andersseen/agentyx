---
title: Getting started
description: Install Agentyx, describe your project once, and converge every coding agent onto the same Skills, MCP servers and hooks.
group: Start here
order: 1
---

Agentyx is a provider-agnostic CLI for giving coding agents the same project-local development
behavior across Codex, Claude Code, Kimi Code and Qwen Code. You describe the environment you want
once, in `.agentyx.json`, and Agentyx installs it into each agent's own documented destinations.

It is plan-first and reversible: nothing is written until a plan says what would change, and
`.agentyx.lock.json` records exactly what Agentyx owns so `sync`, `install --prune` and `uninstall`
can take it back.

## Run it without installing anything

```bash
pnpm dlx @agentyx/cli init
```

`init` detects your stack and the agents already used in the checkout, lets you choose packs, and
writes `.agentyx.json`. Without `--install` it changes nothing else and prints the command to run
next.

To script the same flow:

```bash
pnpm dlx @agentyx/cli init \
  --pack technical \
  --pack typescript \
  --target codex \
  --target qwen \
  --yes \
  --install

pnpm dlx @agentyx/cli doctor
```

## Add it as a dev dependency

Persistent hooks run `npx --no-install agentyx …`, which resolves the project-local binary and never
reaches the network. That means a hook requires `@agentyx/cli` as a real project dependency, not an
ad-hoc `pnpm dlx` invocation:

```bash
pnpm add -D @agentyx/cli
```

`doctor` reports a missing local binary as `hook_runtime_unavailable` rather than letting a hook fail
silently.

## The four commands you will actually use

| Command | What it does |
| --- | --- |
| `agentyx init` | Create `.agentyx.json` for this project. |
| `agentyx configure` | Edit that desired configuration — add or remove packs, enable optional capabilities, change targets. |
| `agentyx sync` | Converge installed provider state onto `.agentyx.json`, pruning what is no longer wanted. |
| `agentyx doctor` | Inspect configuration health, installed-state drift, harness footprint and observed activity. |

`.agentyx.json` is desired state; provider files never rewrite it. `configure` edits the desired
state and `sync` converges the installed state to it.

> [!NOTE]
> Preview anything first with `--dry-run`. `sync --dry-run` reports the planned creates, updates,
> removals and conflicts and writes nothing.

## What gets installed

Packs contribute provider-neutral capabilities:

- **Skills** — installed as native `SKILL.md` files, so agents load relevant instructions on demand.
- **MCP servers** — configured only when selected and active.
- **Hooks** — lifecycle observers, installed only where the provider documents a project-local
  mechanism.
- **Project agents** — optional native subagents, rendered per provider.
- **Local tools** — detected and reported by `doctor`; Agentyx never installs executables.

Every provider receives byte-identical Skill content. The only thing that differs between them is
where the files go. See [Providers](/docs/reference/providers) for the destinations.

## Next

- [Configuration](/docs/configuration) — every `.agentyx.json` field.
- [Packs](/docs/reference/packs) — the capability catalogue.
- [Observability](/docs/guides/observability) — what `doctor` can and cannot tell you.
