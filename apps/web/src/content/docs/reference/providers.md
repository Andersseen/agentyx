---
title: Providers
description: Where Agentyx installs for Codex, Claude Code, Kimi Code and Qwen Code, and what it deliberately declines to do.
group: Reference
order: 21
---

Agentyx is provider agnostic. Packs, Skills, MCP definitions and agents describe development
environments, never providers, so everything a provider knows lives in its adapter. Every provider
receives byte-identical Skill content; the only difference is the destination.

Three words are kept apart throughout:

- **provider supports** — the provider documents the feature.
- **Agentyx supports** — Agentyx installs it, project-local, with tests.
- **Agentyx declines** — the provider supports it but there is no safe project-local installation, so
  Agentyx deliberately does nothing. That is a policy limit, not a provider limit.

## Destinations

Every path is relative to the project root. Agentyx writes nothing else, and never `$HOME`.

| Resource | Codex | Claude Code | Kimi Code | Qwen Code |
| --- | --- | --- | --- | --- |
| Skills | `.agents/skills/…` | `.claude/skills/…` | `.agents/skills/…` | `.qwen/skills/…` |
| Agents | `.codex/agents/<name>.toml` | `.claude/agents/<name>.md` | `.agents/agents/<name>.md` | `.qwen/agents/<name>.md` |
| MCP | `.codex/config.toml` | `.mcp.json` | `.kimi-code/mcp.json` | `.qwen/settings.json` |
| Hooks | `.codex/hooks.json` | `.claude/settings.json` | none | `.qwen/settings.json` |
| Ownership | `.agentyx.lock.json` | same | same | same |

Inspect any target directly:

```bash
pnpm dlx @agentyx/cli target list
pnpm dlx @agentyx/cli target show qwen
```

## Shared destinations

Two kinds of sharing exist, and they are handled differently.

**A directory shared between providers.** Codex and Kimi Code both read `.agents/skills`. One
identical file is planned once, recorded once, and owned by both targets in the lock. Planning for one
target alone never deletes a file the lock also records for the other. Two targets asking for the same
path with *different* content fail with `shared_install_conflict` before anything is written.

**A document shared between capabilities.** Qwen Code reads both `mcpServers` and `hooks` from
`.qwen/settings.json`. Two independent merges of one file cannot both be planned from a read of that
file: the second write would drop what the first added, and the lock — indexed by path — could only
keep one of the two ownership records. So Agentyx plans that file once: the MCP merge runs first and
its output is handed to the hook merge as the document to merge into. The result is one write and one
lock entry of kind `settings`, naming both the servers and the hooks.

`target show qwen` prints the file twice, once per capability, because that is what the provider does.

## Trust gates Agentyx does not bypass

- **Codex** loads project `.codex/` layers only for trusted projects, and non-managed hooks must be
  reviewed with `/hooks` before they run. A written hook is "configured", not "known active". If
  `.codex/config.toml` already defines inline `[hooks]`, Agentyx adds no second `hooks.json` and says
  so.
- **Claude Code** asks for approval before using `.mcp.json` servers in interactive sessions.
- **Kimi Code** treats stdio entries in a project `.kimi-code/mcp.json` as local command execution
  behind its workspace trust prompt.
- **Qwen Code** loads project hooks only for a folder you have trusted; `--safe-mode`, `--bare` and
  `disableAllHooks` all turn them off. Its adapter reports `review-may-be-required` for the same
  reason Codex does.

Treat project agent files as prompt configuration and review them in repositories you do not trust.

## What Agentyx declines

**Kimi Code hooks.** Kimi Code supports lifecycle hooks, but configures them only in the user-level
`~/.kimi-code/config.toml`, and plugin installation is per-user. "Kimi Code supports hooks" and
"Agentyx has a safe project-local hook installation for Kimi Code" are different claims; only the
first is true. Agentyx never writes under `$HOME`, so it declares no hooks for Kimi Code and reports
its runtime usage as unobservable. Kimi still gets the full static analysis.

**Qwen Code HTTP headers from the environment.** Qwen Code documents `headers` as literal values with
no reference mechanism. An HTTP server that needs a header from the environment therefore fails with
`unsupported_mcp_env_reference` instead of being written, because `${VAR}` in a header would be sent
to the server as the credential itself.

**SSE MCP transport.** Agentyx models `stdio` and `http`. A server whose transport an adapter does not
declare fails with `unsupported_mcp_transport`; it is never rendered.

See [Compatibility](/docs/reference/compatibility) for the full rendering rules per provider.
