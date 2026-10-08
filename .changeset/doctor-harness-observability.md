---
"@agentyx/core": minor
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Doctor v2: harness footprint and local observability.

- `agentyx doctor` reports the configured harness footprint (packs, Skills, MCP, tools, hooks), the
  qualitative MCP context surface, pack breadth against project recommendations, and, when provider
  hooks have recorded sessions, observed session rates with numerators and denominators, pack evidence
  (strong/partial/unavailable) and informational cleanup notes for high-context MCP servers with no
  observed use over at least 10 observable sessions. `--json` exposes `harness`, `observation` and
  `utilization`. It never changes `.agentyx.json`.
- The `efficiency` pack now installs three project-local observer hooks. A hidden
  `agentyx hook observe` command stores metadata only (never prompts, tool arguments or output, or
  commands) in `<git dir>/agentyx/usage-v1.jsonl`, bounded to 50 sessions / 256 KiB, local only, silent
  and fail-open.
- Codex now gets project-local hooks (`.codex/hooks.json`), merged with existing user hooks and skipped
  when `.codex/config.toml` already defines inline hooks. Agentyx never bypasses Codex's hook trust.
  Claude hooks cover `SessionStart`, `SessionEnd` and `PostToolUse` (plus `UserPromptExpansion`
  inside the adapter). Kimi Code stays static-only: it supports hooks, but only in user-level config.
- Hook definitions gain optional `matcher`, `async` and `timeout`; provider hook events are
  `SessionStart`, `SessionEnd` and `PostToolUse`. Adapters declare `capabilities.observability`.
