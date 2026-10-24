---
title: CLI reference
description: Every agentyx command, what it reads, what it writes, and how it exits.
group: Reference
order: 23
---

Run any command through `pnpm dlx @agentyx/cli <command>`, or install `@agentyx/cli` as a dev
dependency and use `agentyx <command>`. Every command accepts `--help`.

Agentyx writes UTF-8 files inside the directory or project config file a target owns, plus
`.agentyx.lock.json` at the project root, and nothing else — no shell commands, no network, no
`$HOME`.

## Reading commands

These never write anything.

| Command | Purpose |
| --- | --- |
| `resolve [packs...]` | Resolve the pack and capability composition for this project. |
| `recommend` | Suggest packs and optional capabilities from this project's own files. |
| `doctor` | Inspect configuration, resolution, targets, installability and observed activity. |
| `graph` | Show this project's declared architectural relationships. |
| `pack list` / `pack show <name>` | Inspect capability packs. |
| `skill list` / `skill show <name>` | Inspect the Skills Agentyx ships with. |
| `mcp list` / `mcp show <name>` | Inspect MCP servers Agentyx ships with. |
| `target list` / `target show <id>` | Inspect the agents Agentyx can install into. |
| `source inspect <name>` | Validate a pinned local checkout of a trusted external source. |

`resolve --explain` adds the reason each capability is present. `--json` on any of these prints JSON
and nothing else.

`resolve` prints identifiers only, never Skill contents.

## Writing commands

| Command | Purpose |
| --- | --- |
| `init` | Create `.agentyx.json` for this project. |
| `configure` | Edit an existing desired configuration. |
| `sync` | Make installed provider state match `.agentyx.json`. |
| `install [packs...]` | Install resolved Skills, agents, MCP servers and hooks into each target. |
| `uninstall` | Remove what Agentyx installed into this project. |
| `report` | Write a self-contained HTML report of this project's harness. |

`init` without `--install` only writes `.agentyx.json` and tells you the install command to run.
`configure --sync` applies the change afterwards and keeps the new `.agentyx.json` whatever happens
to the sync.

Useful flags:

```text
--dry-run          report the planned changes without writing anything
--json             print machine-readable JSON only
--force            overwrite unmanaged or drifted destinations
--prune            remove managed files that are no longer wanted
--target <id>      install into this target instead of the configured ones; repeatable
--enable <id>      enable an optional capability for this run; repeatable
--frozen           restore only what the reviewed lock already owns
--locked           compare against the lock's recorded resolution snapshot
--check            exit nonzero on warnings or errors (doctor)
```

`sync` prunes by default; `install` does not unless `--prune` is given.

## The hidden observer

`agentyx hook observe --provider <id>` is what the generated hooks run. It reads the provider's hook
JSON on stdin, keeps a few metadata fields, appends them to `<git dir>/agentyx/usage-v2.jsonl` and
prints nothing. It exits 0 whatever happens, so it can never break a session, and it records nothing
outside a Git checkout.

It never stores prompts, tool arguments or output, commands, file names or secrets.

## Exit behavior

| Situation | Exit |
| --- | --- |
| Successful command; healthy `doctor`; `doctor` with warnings | 0 |
| `doctor --check` with warnings or errors | 1 |
| Missing or invalid `.agentyx.json`; unknown target; unknown capability | 1 |
| `sync` / `install` conflict on an unmanaged or edited destination | 1, nothing written |
| `stale_install_plan` — a destination changed after planning | 1, nothing at those paths written |
| `incomplete_install` — a write failed after earlier changes | 1, earlier changes stay, lock not committed |

Every refusal prints a readable message on **stderr**. An unhandled stack trace means an error escaped
domain-error handling, which is a bug worth reporting.

## Error codes

Refusals carry stable codes rather than prose you have to parse: `unknown_adapter`,
`unknown_pack`, `unknown_skill`, `unknown_mcp_server`, `shared_install_conflict`,
`install_conflict`, `install_path_error`, `stale_install_plan`, `incomplete_install`,
`unsupported_mcp_transport`, `unsupported_mcp_env_reference`, `provider_config_parse_error`,
`frozen_stale_ownership`, `frozen_restore_not_owned`, `frozen_installation_change_required`,
`hook_runtime_unavailable`.
