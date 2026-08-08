---
"@agnox/adapters": minor
"@agnox/core": minor
"@agnox/cli": minor
---

Install resolved skills into coding agents. `@agnox/adapters` gains the `AgentAdapter` contract, an
adapter registry with built-in `codex` and `claude` adapters, plan-first installation
(`planInstall`, `planTargetInstall`) and a filesystem executor (`applyInstallPlans`) that only ever
writes inside the directory a target owns. `@agnox/core` gains `formatSkillMarkdown`, the canonical
`SKILL.md` serialization every provider installs, so a skill has exactly one source. The CLI gains
`agnox install` with `--dry-run`, `--json` and a repeatable `--target`, plus `agnox target list` and
`agnox target show <target>`.
