# @agentyx/cli

Provider-agnostic CLI for selecting Agentyx capability packs and installing their Skills/MCP
configuration into local coding-agent targets.

```sh
agentyx init --pack technical --pack typescript --target codex --yes
agentyx pack list
agentyx resolve
agentyx install --dry-run
agentyx doctor
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
```
