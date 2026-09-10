---
"@agentyx/cli": patch
---

`doctor` no longer reports a project as `healthy` just because its configuration resolves. It now
warns when a resolved configuration has skills or config still waiting to be installed
(`installation_pending`), when no targets are configured at all (`no_targets_configured`), and when
a selected local tool's executable is not on `PATH` (`required_tool_missing`). A project stays
`healthy` once everything selected is both installed and available, matching what `--check` already
enforced in CI.
