---
"@agentyx/adapters": minor
"@agentyx/core": minor
"@agentyx/cli": minor
---

Install resolved skills into coding agents. `@agentyx/adapters` gains the `AgentAdapter` contract, an
adapter registry with built-in `codex` and `claude` adapters, plan-first installation
(`planInstall`, `planTargetInstall`) and a filesystem executor (`applyInstallPlans`) that only ever
writes inside the directory a target owns. `@agentyx/core` gains `formatSkillMarkdown`, the canonical
`SKILL.md` serialization every provider installs, so a skill has exactly one source. The CLI gains
`agentyx install` with `--dry-run`, `--json` and a repeatable `--target`, plus `agentyx target list` and
`agentyx target show <target>`.
