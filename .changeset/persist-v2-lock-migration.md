---
"@agentyx/cli": minor
"@agentyx/core": minor
"@agentyx/adapters": minor
---

Make `.agentyx.lock.json` version 2 the persisted lock contract. Complete config-driven `install`,
`sync`, `init --install` and `configure --sync` now record a reviewed resolution snapshot alongside
ownership entries; manual, pack, `--target`, `--enable`, `--skill`, `--mcp`, `--select`,
`--skills-only` and `--mcp-only` installs write `resolution: null`. Unchanged locks are no longer
rewritten. Existing version-1 locks stay readable for `doctor` and `uninstall`, but `install` and
`sync` now refuse to apply changes until you run the new reviewed migration,
`agentyx install --migrate-lock` (supports `--dry-run`). Install JSON gains an additive `lock`
section. `@agentyx/core` adds `loadInstallManifestState`; `@agentyx/adapters` adds an explicit
`commit` intent and `projectDir` to `applyInstallPlans`.
