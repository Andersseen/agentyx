# @agentyx/cli

## 0.6.0

### Minor Changes

- d0c0de0: Make the first run reach installed skills on its own. `init` now detects the agents already used in
  the project and offers them as targets instead of a fixed pair, explains every pack, capability and
  MCP server with its own description, and finishes by installing — interactively by asking, or with
  the new `--install` flag. `install --select` replaces its scrollable lists with searchable ones and
  an optional pack filter, so choosing among the built-in skills no longer means scrolling through all
  of them. Adapters gain `detectConfiguredTargets` and report `configured` alongside `present`.

### Patch Changes

- Updated dependencies [d0c0de0]
  - @agentyx/adapters@0.6.0
  - @agentyx/core@0.6.0

## 0.5.0

### Minor Changes

- b4559ea: Add safe project-owned Skill directories, local packs, trusted external source inspection, and the
  initial Superpowers source definition. Reject conflicting install scopes and ship the onboarding and
  evaluation foundation for reusable agent environments.

### Patch Changes

- Updated dependencies [b4559ea]
  - @agentyx/core@0.5.0
  - @agentyx/adapters@0.5.0

## 0.4.0

### Minor Changes

- 6490ac0: Add `agentyx doctor --check` so CI can fail on warnings as well as errors.

### Patch Changes

- Updated dependencies [0560ecd]
- Updated dependencies [944407a]
  - @agentyx/adapters@0.4.0
  - @agentyx/core@0.4.0

## 0.3.1

### Patch Changes

- 1db5090: Fix `agentyx pack show <unknown>` crashing with a Node stack trace instead of reporting the failure.
  The command threw a plain `Error`, and `emit` rethrows anything that is not an `AgentyxError` by
  design, so the process died before the message was printed. It now raises `UnknownPackError`, which
  lists the known packs, matching how `resolve`, `skill show` and `mcp show` already behaved.

  `pack show` also read `builtInPacks`, the unvalidated definition input, rather than
  `builtInPackRegistry`. It now reads the registry, so the output reflects the schema defaults and
  normalized capability references that resolution actually uses.

  - @agentyx/adapters@0.3.1
  - @agentyx/core@0.3.1

## 0.3.0

### Minor Changes

- f184242: Track installed files in `.agentyx.lock.json` so installation is reversible and safe to run in a
  shared skills directory. Agentyx now refuses to overwrite a destination it has no record of writing
  (`--force` overrides), `install --prune` removes managed files and MCP entries the current selection
  no longer resolves, `agentyx uninstall` removes everything the manifest records, and `doctor` reports
  stale, edited and unmanaged files.

### Patch Changes

- Updated dependencies [f184242]
  - @agentyx/adapters@0.3.0
  - @agentyx/core@0.3.0

## 0.2.0

### Minor Changes

- e51669d: Replace the previous preset model with composable packs, explicit optional capability
  enablement, and provider-neutral tool definitions.

### Patch Changes

- Updated dependencies [e51669d]
  - @agentyx/core@0.2.0
  - @agentyx/adapters@0.2.0

## 0.1.1

### Patch Changes

- 910572c: Add manual install selection with `agentyx install --select`, plus repeatable `--skill` and `--mcp`
  flags for installing specific built-in skills and MCP servers without a stack configuration.
  - @agentyx/adapters@0.1.1
  - @agentyx/core@0.1.1

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
- 6252e72: Add Kimi Code as a built-in target, render project-local Kimi MCP config, and dedupe shared
  filesystem writes across providers that use the same destination and content.
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

### Patch Changes

- Updated dependencies [443a600]
- Updated dependencies [2ab6f0b]
- Updated dependencies [039fd5a]
- Updated dependencies [6252e72]
- Updated dependencies [66c66fc]
- Updated dependencies [533172a]
  - @agentyx/core@0.1.0
  - @agentyx/adapters@0.1.0
