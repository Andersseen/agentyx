# @agentyx/cli

Provider-agnostic CLI for selecting Agentyx capability packs and installing their Skills/MCP
configuration into local coding-agent targets.

```sh
pnpm dlx @agentyx/cli init --pack technical --pack typescript --target codex --yes
pnpm dlx @agentyx/cli doctor
pnpm dlx @agentyx/cli install --dry-run
pnpm dlx @agentyx/cli install
```

Configuration is pack-first:

```json
{
  "packs": ["technical", "typescript", "angular", "efficiency"],
  "enable": ["rtk"],
  "targets": ["codex", "kimi"]
}
```

`packs` always install their lightweight Skills. Optional heavier capabilities such as `rtk` or
`codebase-memory` are active only when listed in `enable` or passed with `--enable` for that run.

Useful inspection commands:

```sh
agentyx pack show efficiency
agentyx skill list
agentyx mcp list
agentyx target list
agentyx source show superpowers
agentyx source inspect superpowers
```

`doctor --check` keeps normal human or JSON output, but exits with code 1 on warnings as well as
errors so CI can fail before install drift turns into a broken run.

Project-owned packs can reference standard `SKILL.md` directories declared through
`skillDirectories` and `localPacks` in `.agentyx.json`. Paths are project-relative and Agentyx
rejects symlinks that resolve outside the project.

Trusted external sources can be declared through `trustedSources` and inspected locally. The initial
Superpowers integration validates the local `.codex-plugin/plugin.json` and Skill inventory, but
keeps installation disabled until Agentyx can preserve resource-bearing Skill directories.
