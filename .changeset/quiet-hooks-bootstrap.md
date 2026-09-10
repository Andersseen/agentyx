---
"@agentyx/core": minor
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Add hooks as a resolvable resource alongside MCP servers and tools. The `efficiency` pack now
contributes a `session-doctor-bootstrap` hook that Claude Code installs into
`.claude/settings.json` as a `SessionStart` hook: it runs `agentyx doctor --hook` at session start,
which stays silent when the project is healthy and prints one line pointing at `agentyx doctor`
otherwise. Codex and Kimi Code have no documented hook mechanism, so the capability is Claude Code
only for now. `agentyx doctor`, `resolve`, `pack show`, `install`, `uninstall` and `target show` all
report hooks the same way they already report MCP servers and tools.
