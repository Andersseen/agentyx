# @agentyx/adapters

## 0.11.0

### Minor Changes

- 6aa2865: Doctor usage is now configuration-aware: sessions are tied to a fingerprint of the installed harness (`usage-v2.jsonl`), so changing the harness starts a fresh baseline, old sessions can no longer make a newly enabled capability look dormant, and negative evidence is withheld while installation is pending or a provider's observer hooks are not installed.

### Patch Changes

- Updated dependencies [6aa2865]
  - @agentyx/core@0.11.0

## 0.10.0

### Minor Changes

- 048cbc7: Doctor v2: harness footprint and local observability.

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

### Patch Changes

- Updated dependencies [048cbc7]
  - @agentyx/core@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [283a21f]
  - @agentyx/core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [65a4adb]
  - @agentyx/core@0.8.0

## 0.7.0

### Patch Changes

- 6cc6ddf: Add deterministic project discovery: `agentyx recommend` reads `package.json` and a small set of
  known repository files (Dockerfile, `.github/workflows`, workspace markers) and suggests built-in
  packs and optional capabilities with a human-readable reason each. No network access, no telemetry,
  no LLM, and no writes — `init` and `doctor` use the same engine for defaults and advisory
  suggestions, but enabling anything remains an explicit, separate step.

  Also, while auditing the capabilities this makes discoverable:

  - The `session-doctor-bootstrap` hook now runs `npx --no-install agentyx doctor --hook`, so a
    missing local `agentyx` binary fails fast instead of risking a lookup of a package that does not
    exist under that name. `doctor` now reports `hook_runtime_unavailable` when the hook is active but
    `@agentyx/cli` is not installed as a project dependency.
  - Built-in MCP servers declare a `runtime` (`"local"` or `"may-download"`) so `mcp show` and
    `pack show` say upfront whether enabling a capability can fetch a package on first launch, and the
    `npx`-launched servers (`playwright`, `chrome-devtools`, `supabase`) pin a known-compatible version
    instead of `@latest`.

- Updated dependencies [6cc6ddf]
  - @agentyx/core@0.7.0

## 0.6.0

### Minor Changes

- 56dcf02: Add hooks as a resolvable resource alongside MCP servers and tools. The `efficiency` pack now
  contributes a `session-doctor-bootstrap` hook that Claude Code installs into
  `.claude/settings.json` as a `SessionStart` hook: it runs `agentyx doctor --hook` at session start,
  which stays silent when the project is healthy and prints one line pointing at `agentyx doctor`
  otherwise. Codex and Kimi Code have no documented hook mechanism, so the capability is Claude Code
  only for now. `agentyx doctor`, `resolve`, `pack show`, `install`, `uninstall` and `target show` all
  report hooks the same way they already report MCP servers and tools.
- d0c0de0: Make the first run reach installed skills on its own. `init` now detects the agents already used in
  the project and offers them as targets instead of a fixed pair, explains every pack, capability and
  MCP server with its own description, and finishes by installing — interactively by asking, or with
  the new `--install` flag. `install --select` replaces its scrollable lists with searchable ones and
  an optional pack filter, so choosing among the built-in skills no longer means scrolling through all
  of them. Adapters gain `detectConfiguredTargets` and report `configured` alongside `present`.

### Patch Changes

- Updated dependencies [56dcf02]
- Updated dependencies [5f9762b]
  - @agentyx/core@0.6.0

## 0.5.0

### Minor Changes

- b4559ea: Add safe project-owned Skill directories, local packs, trusted external source inspection, and the
  initial Superpowers source definition. Reject conflicting install scopes and ship the onboarding and
  evaluation foundation for reusable agent environments.

### Patch Changes

- Updated dependencies [b4559ea]
  - @agentyx/core@0.5.0

## 0.4.0

### Minor Changes

- 0560ecd: Reject symlinked install paths during planning and execution so project-local destinations cannot redirect writes outside the project.

### Patch Changes

- Updated dependencies [944407a]
  - @agentyx/core@0.4.0

## 0.3.1

### Patch Changes

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
  - @agentyx/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [e51669d]
  - @agentyx/core@0.2.0

## 0.1.1

### Patch Changes

- @agentyx/core@0.1.1

## 0.1.0

### Minor Changes

- 2ab6f0b: Add provider-agnostic MCP server support. Stacks can now declare `mcpServers`, resolution returns
  MCP identifiers, the CLI gains `agentyx mcp list/show`, and install plans merge resolved MCP servers
  into project-local Codex and Claude Code configuration without executing MCP processes.
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

- 443a600: Add project detection, `agentyx init`, `agentyx doctor`, root dogfooding config, adoption fixtures and package-artifact smoke validation.
- Updated dependencies [443a600]
- Updated dependencies [2ab6f0b]
- Updated dependencies [039fd5a]
- Updated dependencies [66c66fc]
- Updated dependencies [533172a]
  - @agentyx/core@0.1.0
