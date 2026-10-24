---
title: Compatibility
description: Per-provider rendering rules for MCP servers, hooks and agents, and the failure modes Agentyx chooses over writing a wrong value.
group: Reference
order: 22
---

Provider facts come from each provider's official documentation, not from Agentyx source comments.
The authoritative version of this page is
[`docs/compatibility.md`](https://github.com/Andersseen/agentyx/blob/main/docs/compatibility.md) in
the repository, which also records what was **not** verified.

## MCP rendering

Agentyx's MCP model has two transports (`stdio`, `http`) and values that are environment
*references*, never secrets.

| | Codex | Claude Code | Kimi Code | Qwen Code |
| --- | --- | --- | --- | --- |
| Document | `.codex/config.toml` | `.mcp.json` | `.kimi-code/mcp.json` | `.qwen/settings.json` |
| stdio | `command`, `args`, `env`, `enabled` | `type: "stdio"`, `command`, `args`, `env` | `command`, `args`, `env` | `command`, `args`, `env` |
| HTTP | `url`, `enabled` | `type: "http"`, `url` | `url` | `httpUrl` |
| env reference | `env_vars = ["NAME"]` | `"NAME": "${NAME}"` | omitted | `"NAME": "${NAME}"` |
| header reference | `env_http_headers = { Header = "NAME" }` | `"Header": "${NAME}"` | omitted | **fails** |

Four rules follow from that table:

- **Codex** `env` holds literal values and `env_vars` forwards named host variables, so a reference is
  only expressible when the server expects the variable under its own name. Any other mapping fails
  with `unsupported_mcp_env_reference` rather than writing a wrong value.
- **Kimi Code** documents `env` and `headers` as literal values with no expansion, so Agentyx writes
  no reference at all instead of a literal variable *name*. Whether the child process inherits the
  host environment is not documented; a server needing a token relies on that. This is a known
  limitation, not a verified pass.
- **Qwen Code** documents `$VAR`/`${VAR}` expansion for `env`, which Agentyx renders. It documents
  `headers` as literal values, so an authenticated HTTP server cannot be expressed and fails instead.
  Its `http` transport renders as `httpUrl`; `url` is Qwen Code's legacy SSE key.
- A server whose transport an adapter does not declare fails with `unsupported_mcp_transport`.

Codex TOML is parsed and re-serialized, so comments and numeric literal style in `.codex/config.toml`
are not preserved. Values are.

## Hook rendering

Claude Code, Codex and Qwen Code all use the same JSON shape: `hooks.<Event>[] = { matcher, hooks[] }`.
Each generated entry carries `statusMessage: "agentyx:<hook name>"`, a real field the providers show
as the hook's spinner label. Every run strips every `agentyx:`-tagged entry and regenerates the active
ones fresh; nothing else in the file is read or touched.

Agentyx registers three observer hooks plus one doctor hook:

| Hook | Event | Purpose |
| --- | --- | --- |
| `session-doctor-bootstrap` | `SessionStart` | Reports project health at session start; silent when healthy. |
| `observe-session-start` | `SessionStart` | Records that a session started. |
| `observe-session-end` | `SessionEnd` | Records that a session ended. |
| `observe-tool-use` | `PostToolUse` | Records which MCP servers were used. |

Hooks run `npx --no-install agentyx …`, so `@agentyx/cli` must be a project dependency. They print
nothing, exit 0 whatever happens, and can never block a session.

Codex also reads inline `[hooks]` from `.codex/config.toml` and warns when one layer defines hooks in
both representations, so Agentyx writes `hooks.json` only when the project has no inline `[hooks]`.

## Agent rendering

Core knows two access levels, `read-only` and `workspace-write`, and no provider tool names. Each
adapter maps them, and all four providers get the same canonical instruction body.

| | Codex | Claude Code | Kimi Code | Qwen Code |
| --- | --- | --- | --- | --- |
| Format | TOML | Markdown + frontmatter | Markdown + frontmatter | Markdown + frontmatter |
| Fields emitted | `name`, `description`, `developer_instructions`, `sandbox_mode` | `name`, `description`, `tools` | those three plus `override: false` | `name`, `description`, `tools` |
| `read-only` | `sandbox_mode = "read-only"` | `tools: Read, Grep, Glob` | same | list of `read_file`, `grep_search`, `glob` |
| `workspace-write` | `sandbox_mode = "workspace-write"` | adds `Bash`, `Write`, `Edit` | same | adds `run_shell_command`, `write_file`, `edit` |
| Enforcement | sandbox | tool allowlist | tool allowlist | tool allowlist |

A read-only agent receives no write, shell or delegation tool, and a workspace-write agent never
receives a delegation tool, a wildcard or MCP tools. Omitting `tools` would inherit everything in
Claude Code, Kimi Code and Qwen Code, so it is always set.

Codex has no per-tool list in its documented format: `sandbox_mode` is the only enforceable boundary,
and the provider documents that live parent-turn overrides are reapplied to child agents, so the file
is a default rather than an absolute ceiling.

`workspace-write` is one coarse level. `agentyx-verifier` uses it so it can run checks, which also
means it is *able* to edit files; its instructions, not a permission, keep it from doing so.

## Platforms

| Platform | Evidence |
| --- | --- |
| Linux, Node 22 and 24 | CI `check` job: frozen install, lint, typecheck, tests, build, CLI smoke, `pnpm smoke:pack` |
| macOS, Node 22 | CI `platform-smoke` job: `pnpm smoke:pack` |
| Windows, Node 22 | CI `platform-smoke` job: `pnpm smoke:pack` |

`engines.node` stays `>=22`.

## What none of this proves

The compatibility tests check configuration rendering and lifecycle safety. They do **not** prove that
a provider loaded, trusted or used anything Agentyx wrote — Claude Code invoking an installed Skill,
Codex spawning an installed agent, or Qwen Code connecting to an MCP server. That is real-provider
activation evidence and is tracked separately in the roadmap.
