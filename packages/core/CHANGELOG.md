# @agentyx/core

## 0.6.0

## 0.5.0

### Minor Changes

- b4559ea: Add safe project-owned Skill directories, local packs, trusted external source inspection, and the
  initial Superpowers source definition. Reject conflicting install scopes and ship the onboarding and
  evaluation foundation for reusable agent environments.

## 0.4.0

### Minor Changes

- 944407a: Use the repository-hosted JSON Schema identifier instead of the unrelated agentyx.dev domain.

## 0.3.1

## 0.3.0

### Minor Changes

- f184242: Track installed files in `.agentyx.lock.json` so installation is reversible and safe to run in a
  shared skills directory. Agentyx now refuses to overwrite a destination it has no record of writing
  (`--force` overrides), `install --prune` removes managed files and MCP entries the current selection
  no longer resolves, `agentyx uninstall` removes everything the manifest records, and `doctor` reports
  stale, edited and unmanaged files.

## 0.2.0

### Minor Changes

- e51669d: Replace the previous preset model with composable packs, explicit optional capability
  enablement, and provider-neutral tool definitions.

## 0.1.1

## 0.1.0

### Minor Changes

- 443a600: Add project detection, `agentyx init`, `agentyx doctor`, root dogfooding config, adoption fixtures and package-artifact smoke validation.
- 2ab6f0b: Add provider-agnostic MCP server support. Stacks can now declare `mcpServers`, resolution returns
  MCP identifiers, the CLI gains `agentyx mcp list/show`, and install plans merge resolved MCP servers
  into project-local Codex and Claude Code configuration without executing MCP processes.
- 039fd5a: Add provider-agnostic skills. Stacks now declare a `skills` list, `resolveStackSkills()` expands it
  through stack inheritance, and the resolved configuration carries the resulting skill identifiers.
  `@agentyx/core` ships five built-in skills as `SKILL.md` package assets — `planning`,
  `systematic-debugging`, `verification`, `typescript-modern`, `angular-modern` — behind a lazy
  `SkillRegistry`, so resolution stays on identifiers and never reads a skill body. The CLI gains
  `agentyx skill list` and `agentyx skill show <name>`, and `agentyx resolve` prints a `Skills` section.
- 66c66fc: Install resolved skills into coding agents. `@agentyx/adapters` gains the `AgentAdapter` contract, an
  adapter registry with built-in `codex` and `claude` adapters, plan-first installation
  (`planInstall`, `planTargetInstall`) and a filesystem executor (`applyInstallPlans`) that only ever
  writes inside the directory a target owns. `@agentyx/core` gains `formatSkillMarkdown`, the canonical
  `SKILL.md` serialization every provider installs, so a skill has exactly one source. The CLI gains
  `agentyx install` with `--dry-run`, `--json` and a repeatable `--target`, plus `agentyx target list` and
  `agentyx target show <target>`.
- 533172a: Add the first Agentyx domain layer: the `.agentyx.json` configuration model, the stack definition model
  with a built-in `core` / `typescript` / `angular` registry, deterministic stack resolution, and the
  `agentyx resolve` command.
