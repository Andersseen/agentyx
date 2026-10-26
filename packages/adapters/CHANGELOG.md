# @agentyx/adapters

## 0.24.0

### Minor Changes

- 1b2e038: Add the `creative-web` design pack for expressive websites: creative direction, web composition,
  typographic art direction, visual storytelling, motion art direction, design critique and concept-based
  reference research. It shares `design-system-practice` and `visual-verification` with `ui-ux`, which
  stays focused on product-interface quality, and is never recommended automatically from project
  technology.

### Patch Changes

- Updated dependencies [1b2e038]
  - @agentyx/core@0.24.0

## 0.23.0

### Minor Changes

- 854dcea: Add Qwen Code as an install target: Skills to `.qwen/skills`, project agents to `.qwen/agents`, and both MCP servers and hooks into `.qwen/settings.json`.
  
  Qwen Code reads MCP servers and hooks from one document, so Agentyx now plans such a file as a single merge instead of two independent ones, which would each be planned from a stale read and let the second write drop the first. The lock records it as one `settings` entry naming both the servers and the hooks; existing `mcp` and `hook` entries for other providers are unchanged, and a lock written before this change is still read and pruned correctly.
  
  Qwen Code documents `$VAR`/`${VAR}` expansion for a stdio server's `env`, which Agentyx renders, but documents `headers` as literal values with no reference mechanism. An HTTP server needing a header from the environment therefore fails with `unsupported_mcp_env_reference` rather than writing `${VAR}`, which the provider would send as the credential itself. Its `http` transport renders as `httpUrl`, never as `url` — that key is Qwen Code's legacy SSE transport.
  
  Doctor reports Qwen Code session lifecycle, tool use and MCP use, but not Skill use: the provider documents no `Skill` tool, so a model-selected Skill leaves no hook payload, and counting only explicitly typed `/skill` invocations would report every other use as "no observed use". Qwen Code loads project hooks only for a trusted folder, so its hooks are reported as configured with review possibly required, never as active.

### Patch Changes

- Updated dependencies [854dcea]
  - @agentyx/core@0.23.0

## 0.22.0

### Minor Changes

- 1be6dcb: Make the common project setup, provider observation requirements, and verified evaluation path clearer. Use shell-form Claude hooks for Windows compatibility.

### Patch Changes

- Updated dependencies [1be6dcb]
  - @agentyx/core@0.22.0

## 0.21.0

### Minor Changes

- afd6424: Add `agentyx report`, a deterministic, self-contained HTML report of the project's Agentyx harness:
  desired state, why each capability is selected, providers, Doctor readiness, locked-resolution
  comparison, lock-recorded ownership and the project graph. It is read-only apart from the requested
  project-relative `.html` file (`--output`, `--overwrite`), works offline from `file://`, and omits
  Skill bodies, secrets, hashes and absolute paths.

### Patch Changes

- Updated dependencies [afd6424]
  - @agentyx/core@0.21.0

## 0.20.0

### Minor Changes

- 8d13659: Add `agentyx doctor --locked` and `agentyx install --frozen`. `doctor --locked` compares the current
  harness inputs (configuration, selected Skill sources, exact CLI version) with the complete
  resolution snapshot in the version-2 lock and reports a structured `reproducibility` state; any
  locked contract failure exits 1. `install --frozen` re-checks that snapshot and may only restore a
  missing Skill file the lock already owns; it rejects every other change and never rewrites the lock.
  Adapters gain a `read-only` lock commit intent and a frozen-plan validator.

### Patch Changes

- Updated dependencies [8d13659]
  - @agentyx/core@0.20.0

## 0.19.0

### Minor Changes

- eeed462: Make `.agentyx.lock.json` version 2 the persisted lock contract. Complete config-driven `install`,
  `sync`, `init --install` and `configure --sync` now record a reviewed resolution snapshot alongside
  ownership entries; manual, pack, `--target`, `--enable`, `--skill`, `--mcp`, `--select`,
  `--skills-only` and `--mcp-only` installs write `resolution: null`. Unchanged locks are no longer
  rewritten. Existing version-1 locks stay readable for `doctor` and `uninstall`, but `install` and
  `sync` now refuse to apply changes until you run the new reviewed migration,
  `agentyx install --migrate-lock` (supports `--dry-run`). Install JSON gains an additive `lock`
  section. `@agentyx/core` adds `loadInstallManifestState`; `@agentyx/adapters` adds an explicit
  `commit` intent and `projectDir` to `applyInstallPlans`.

### Patch Changes

- Updated dependencies [eeed462]
  - @agentyx/core@0.19.0

## 0.18.0

### Minor Changes

- 1bcfc3e: Add the version-2 lock manifest model and deterministic provider-neutral resolution snapshot API.
  Normal installation continues to write version-1 ownership locks until the explicit migration and
  snapshot persistence workflow lands.

### Patch Changes

- Updated dependencies [1bcfc3e]
  - @agentyx/core@0.18.0

## 0.17.0

### Minor Changes

- ecec94e: Add structured Doctor readiness states for configuration, installation convergence and locally
  inspectable prerequisites. Doctor now reports active MCP launcher and environment-reference gaps,
  provider compatibility errors and the boundary that MCP runtime, connectivity and authorization
  remain unverified.

### Patch Changes

- Updated dependencies [ecec94e]
  - @agentyx/core@0.17.0

## 0.16.0

### Minor Changes

- 5488aa0: Add typed capability exclusions to `.agentyx.json` and `configure`, covering Skills, MCP servers,
  tools, hooks and agents while preserving resolution provenance and safe sync pruning.

### Patch Changes

- Updated dependencies [5488aa0]
  - @agentyx/core@0.16.0

## 0.15.0

### Minor Changes

- 759c7df: Add the provider-neutral `ui-ux` pack with focused visual design, usability, interaction,
  design-system, UX-writing and visual-verification Skills. The pack contributes optional Playwright
  with shared resolution provenance.

### Patch Changes

- Updated dependencies [759c7df]
  - @agentyx/core@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [a99c2de]
  - @agentyx/core@0.14.0

## 0.13.2

### Patch Changes

- ec06aa0: Harden installs against stale plans and partial failures. Every planned write or deletion now records the destination state it observed, and the executor revalidates it before the first write and again before each change, so a file created or edited after planning (including a user edit to `.mcp.json` or `.claude/settings.json`, and including under `--force`) is never overwritten or deleted and fails with `stale_install_plan`. A failure after earlier changes now fails with `incomplete_install`, listing completed and not-applied paths; nothing is rolled back and the lock is committed only after every provider change succeeded. `.agentyx.lock.json` is replaced through a same-directory temporary file and a rename. `configure --sync` keeps these codes.
- @agentyx/core@0.13.2

## 0.13.1

### Patch Changes

- 8c9ce11: Fix MCP environment references for Codex and Kimi Code, which previously received the variable *name* as a literal value. Codex now forwards the variable with `env_vars`; Kimi Code, which documents no reference mechanism, no longer gets a wrong literal. A server transport an adapter does not declare now fails with `unsupported_mcp_transport` instead of being rendered, and `uninstall --help` now mentions agents. Codex documentation links point at the current official pages.
- @agentyx/core@0.13.1

## 0.13.0

### Minor Changes

- 52240e2: Add optional provider-neutral project agents and native installation for Claude Code, Kimi Code, and Codex CLI.

### Patch Changes

- Updated dependencies [52240e2]
  - @agentyx/core@0.13.0

## 0.12.0

### Patch Changes

- @agentyx/core@0.12.0

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
