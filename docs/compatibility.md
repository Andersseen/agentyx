# Provider and platform compatibility

Verified against Agentyx **0.13.0** on **2026-10-10** (roadmap task R100-01). Provider facts below
come from each provider's official documentation, fetched on that date; the pages are listed under
[References](#references). Agentyx source comments are not evidence for provider behavior.

## What this document does and does not prove

It proves that the files Agentyx writes match the formats the providers document, that the install
lifecycle only touches what `.agentyx.lock.json` records, and that the packed CLI runs on the
platforms listed under [Platforms](#platforms).

It does **not** prove that a provider loaded, trusted or used anything Agentyx wrote: Claude Code
invoking an installed Skill, Codex spawning an installed agent, or Kimi Code connecting to an MCP
server. That is real-provider activation evidence and belongs to roadmap tasks R100-03 and R100-04.

Three words are kept apart throughout:

- **provider supports** — the provider documents the feature.
- **Agentyx supports** — Agentyx installs it, project-local, with tests.
- **Agentyx declines** — the provider supports it but there is no safe project-local installation,
  so Agentyx deliberately does nothing. This is a policy limit, not a provider limit.

## Matrix

| Capability | Codex | Claude Code | Kimi Code |
|---|---|---|---|
| Skills | supported | supported | supported |
| Skill path (Agentyx writes) | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| Skill path also read by provider | `.agents/skills` from cwd up to the repo root | — | `.kimi-code/skills` |
| MCP project config | `.codex/config.toml`, `[mcp_servers.<name>]` | `.mcp.json`, `mcpServers` | `.kimi-code/mcp.json`, `mcpServers` |
| stdio MCP | supported | supported | supported |
| HTTP MCP | supported | supported | supported |
| SSE MCP | not modeled by Agentyx | not modeled (provider: deprecated) | not modeled (provider supports it) |
| Env references in MCP | stdio: `env_vars`; HTTP headers: `env_http_headers` | `${VAR}` in `env` and `headers` | **not renderable** — see below |
| Project hooks | provider supports; Agentyx supports `.codex/hooks.json` | provider supports; Agentyx supports `.claude/settings.json` | provider supports; **Agentyx declines** (user-level only) |
| Doctor runtime observation | session lifecycle, tool use, MCP use | session lifecycle, tool use, Skill use, MCP use, context size (resume/fork only) | none |
| Custom project agents | supported | supported | supported |
| Agent path (Agentyx writes) | `.codex/agents/<name>.toml` | `.claude/agents/<name>.md` | `.agents/agents/<name>.md` |
| Agent format | TOML | Markdown + YAML frontmatter | Markdown + YAML frontmatter |
| Everything project-local, nothing under `$HOME` | yes | yes | yes |

### Trust and approval behavior Agentyx does not bypass

- **Codex** loads project `.codex/` layers (MCP, hooks) only for trusted projects. Non-managed hooks
  must be reviewed with `/hooks` before they run, and trust is tied to the hook's hash, so a
  written hook is "configured", not "known active". The agents page documents no trust step.
- **Claude Code** asks for approval before using `.mcp.json` servers in interactive sessions
  (non-interactive `-p` runs load them without asking). Agentyx emits no agent frontmatter hooks.
- **Kimi Code** treats stdio entries in a project `.kimi-code/mcp.json` as local command execution
  behind its workspace trust prompt.

Treat project agent files as prompt configuration and review them in untrusted repositories.

## Destinations Agentyx manages

Every path is relative to the project root. Agentyx writes nothing else, and never `$HOME`.

| Resource | Codex | Claude Code | Kimi Code |
|---|---|---|---|
| Skills | `.agents/skills/…` (shared with Kimi) | `.claude/skills/…` | `.agents/skills/…` (shared with Codex) |
| MCP | `.codex/config.toml` | `.mcp.json` | `.kimi-code/mcp.json` |
| Hooks | `.codex/hooks.json` | `.claude/settings.json` | none |
| Agents | `.codex/agents/…` | `.claude/agents/…` | `.agents/agents/…` |
| Ownership record | `.agentyx.lock.json` | same | same |

Provider config files that users also edit (MCP, hooks) are never claimed as a whole: the lock
records only the server and hook keys Agentyx added, and prune/uninstall remove only those. Skill
and agent files are claimed per file with a content hash; an unmanaged same-path file is a
`conflict`, never overwritten without `--force`.

Codex hooks: when `.codex/config.toml` already defines inline `[hooks]`, Agentyx does not add
`.codex/hooks.json` (Codex warns when one layer uses both).

### Shared `.agents` directory

Codex and Kimi Code both read `.agents/skills`. One identical file is planned once, recorded once,
and owned by both targets in the lock. Planning for one target alone never deletes a file the lock
also records for the other; `sync` additionally retires targets that were removed from
`.agentyx.json`. Two targets asking for the same path with different content fail with
`shared_install_conflict` before anything is written. Only Kimi uses `.agents/agents`; Codex agents
live in `.codex/agents`, so the agent directories are not shared today.

## Agent rendering

Core knows two access levels, `read-only` and `workspace-write`, and no provider tool names. Each
adapter maps them. All three providers get the same canonical instruction body.

| | Codex | Claude Code | Kimi Code |
|---|---|---|---|
| Required fields (provider) | `name`, `description`, `developer_instructions` | `name`, `description` | `description` (`name` optional) |
| Fields Agentyx emits | those three + `sandbox_mode` | `name`, `description`, `tools` | `name`, `description`, `tools`, `override: false` |
| `read-only` | `sandbox_mode = "read-only"` | `tools: Read, Grep, Glob` | `tools: Read, Grep, Glob` |
| `workspace-write` | `sandbox_mode = "workspace-write"` | `tools: Read, Grep, Glob, Bash, Write, Edit` | same tool list |
| Enforcement | sandbox | tool allowlist | tool allowlist |

What this does and does not guarantee:

- Claude Code and Kimi Code: `tools` is an explicit allowlist. A read-only agent receives no
  `Bash`, `Write`, `Edit` or delegation tool, and a workspace-write agent never receives
  `Agent`, a wildcard or MCP tools. Omitting `tools` would inherit everything, so it is always set.
- Codex: there is no per-tool list in the documented format. `sandbox_mode` is the only enforceable
  boundary. The provider documents that live parent-turn overrides (such as `/permissions` or
  `--yolo`) are reapplied to child agents, so the file is a default, not an absolute ceiling. A
  Codex agent also inherits `mcp_servers` and `skills.config` from its parent because Agentyx sets
  neither.
- `workspace-write` is one coarse level. `agentyx-verifier` uses it so it can run checks, which
  also means it is *able* to edit files; its instructions, not a permission, keep it from doing so.
- Kimi Code documents no dedicated read-only setting; a tool allowlist is its mechanism. Agentyx
  never sets `override: true`, `subagents` or a model.

## MCP rendering

Agentyx's MCP model has two transports (`stdio`, `http`) and values that are environment
*references*, never secrets.

| | Codex (`.codex/config.toml`) | Claude Code (`.mcp.json`) | Kimi Code (`.kimi-code/mcp.json`) |
|---|---|---|---|
| stdio | `command`, `args`, `env`, `enabled` | `type: "stdio"`, `command`, `args`, `env` | `command`, `args`, `env` |
| HTTP | `url`, `enabled` | `type: "http"`, `url` | `url` |
| env reference (stdio) | `env_vars = ["NAME"]` | `"NAME": "${NAME}"` | omitted |
| header reference (HTTP) | `env_http_headers = { Header = "NAME" }` | `"Header": "${NAME}"` | omitted |

- **Codex** `env` holds literal values and `env_vars` forwards named host variables, so a reference
  is only expressible when the server expects the variable under its own name. Any other mapping
  fails with `unsupported_mcp_env_reference` rather than writing a wrong value.
- **Kimi Code** documents `env` and `headers` as literal values with no expansion or forwarding
  (only `bearerTokenEnvVar` for a bearer token). Agentyx therefore writes no reference at all
  instead of a literal variable *name*. Whether the child process inherits the host environment is
  not documented; a server needing a token (for example `supabase`) relies on that. This is a known
  limitation, not a verified pass.
- A server whose transport an adapter does not declare in `capabilities.mcp.transports` fails with
  `unsupported_mcp_transport`; it is never rendered. Providers whose capabilities declare no
  project MCP scope report the servers as unsupported without failing Skill installation.
- Codex TOML is parsed and re-serialized, so comments and numeric literal style in
  `.codex/config.toml` are not preserved; values are.

## Doctor observability

Flags live in each adapter's `capabilities.observability` and are asserted in
`packages/adapters/test/compatibility.test.ts`. They describe signals Agentyx's hooks can receive,
not whether a hook was trusted or runs.

| Signal | Codex | Claude Code | Kimi Code |
|---|---|---|---|
| Session lifecycle | yes | yes | no |
| Tool use | yes | yes | no |
| Skill use | no (undocumented) | yes | no |
| MCP use | yes (`mcp__server__tool`) | yes (`mcp__<server>__<tool>`) | no |
| Context size | no | `context_tokens`, `SessionStart` on resume/fork only | no |

Verification gaps, stated plainly: the Claude hooks reference confirms that a `Skill` tool exists
and that `UserPromptExpansion` can see a typed `/skill`, but the pages read do not spell out the
`PostToolUse` `tool_input` field name Agentyx reads for Skill use, so the Claude Skill signal rests
on provider behavior beyond what was confirmed. Context size is reported only for resumed or
forked sessions. "No observed use" remains distinct from "unobservable" in Doctor.

## Not verified against documentation

These are written by Agentyx but were not spelled out in the pages read on 2026-10-10; they are
unchanged by this task:

- Codex MCP `enabled = true` and `env = {}`.
- Claude Code hook handlers using `command` with `args` and `async` (Agentyx stamps each with
  `statusMessage: "agentyx:<hook>"` to find its own entries).

## Platforms

| Platform | Evidence |
|---|---|
| Linux, Node 22 and 24 | CI `check` job: frozen install, `biome ci`, typecheck, tests, build, CLI smoke, `pnpm smoke:pack` |
| macOS, Node 22 | CI `platform-smoke` job: `pnpm smoke:pack` |
| Windows, Node 22 | CI `platform-smoke` job: `pnpm smoke:pack` |

`pnpm smoke:pack` builds, packs the three tarballs, installs them into a project **outside the
workspace**, and runs the packed CLI (with `$HOME` pointed at an empty directory that must stay
empty) through: init, configure, sync, doctor, hooks, MCP, agents, prune, uninstall, JSON output and
exit codes, for Codex, Claude Code and Kimi Code together. It also compares the packaged Skill and
agent directories to the source tree. `engines.node` stays `>=22`; changing it is a product
decision, not a by-product of another version passing.

## Exit behavior (preparation for 1.0, not yet frozen)

Observed and covered by the packaged smoke test:

| Situation | Exit |
|---|---|
| Successful command; healthy `doctor`; `doctor` with warnings | 0 |
| `doctor --check` with warnings or errors | 1 |
| Missing `.agentyx.json`; invalid JSON; unknown target; unknown or non-selectable capability in `configure` | 1 |
| `sync`/`install` conflict (unmanaged or edited destination) | 1, nothing written |

Every refusal is a nonzero exit with a message on stderr and no partial write for these cases.
Stable error codes and a formal JSON contract belong to roadmap task R1000-01.

## References

All fetched 2026-10-10. Codex documentation has moved from `developers.openai.com/codex/*`
(now a permanent redirect) to `learn.chatgpt.com`.

- Codex skills — <https://learn.chatgpt.com/docs/build-skills>
- Codex MCP — <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>
- Codex hooks — <https://learn.chatgpt.com/docs/hooks>
- Codex custom agents — <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- Claude Code skills — <https://code.claude.com/docs/en/skills>
- Claude Code MCP — <https://code.claude.com/docs/en/mcp>
- Claude Code hooks — <https://code.claude.com/docs/en/hooks>
- Claude Code subagents — <https://code.claude.com/docs/en/sub-agents>
- Kimi Code skills — <https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html>
- Kimi Code MCP — <https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html>
- Kimi Code hooks — <https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html>
- Kimi Code agents — <https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents.html>
- Kimi Code built-in tools — <https://www.kimi.com/code/docs/en/kimi-code-cli/reference/tools.html>
