# Roadmap implementation progress

One record per task, in completion order. See [session-playbook.md](session-playbook.md) for the
template and verification requirements this log follows.

## R090-04 — Reproducibility workflow and artifact closeout

Status: implementation and local verification complete; pull-request CI pending.
Starting main SHA: `cb0345348731d1bd92ba93c9f117a6411c1eba20`.
Starting package versions: `@agentyx/core`, `@agentyx/adapters`, and `@agentyx/cli` were `0.20.0`.
R090-01, R090-02, and R090-03 were already complete on the starting main.

Delivered:
- Added [the user reproducibility guide](../reproducibility.md), covering exact CLI pinning,
  package-manager vs Agentyx lock responsibilities, project-local source commits, fresh checkout,
  initial lock creation, intentional changes/upgrades, v1 migration, and conservative recovery.
- Distinguished ownership entries from the resolution snapshot and locked matching from installed
  readiness. Documented external MCP/runtime limits without claiming a hermetic build.
- Updated README migration/locked/frozen examples to run the exact project-local CLI and linked the
  canonical guide. Added a short package README link.
- Reused the existing R090-03 packed checks for locked comparison, frozen restore/refusal, exact
  Skill bytes, Agentyx lock invariance, mismatch handling, and historical v1 migration.
- Added a packed external consumer lifecycle using exact local artifact specs and offline pnpm
  installs. It verifies the installed package version and `pnpm exec` CLI, frozen package-lock
  byte invariance, missing owned Skill restoration, Agentyx lock byte invariance, and final locked
  Doctor verification.
- No Changeset: this task documents and verifies behavior released in `0.20.0`; no published
  package behavior or machine-readable contract changed.

Local verification on Node `22.23.1`:
- `pnpm check` — passed; 66 test files and 829 tests, typecheck and workspace build passed. Biome
  reported its existing schema-version notice and two warnings in `packages/adapters/test`.
- `pnpm eval:skills` — passed; 11 scenarios.
- `pnpm smoke:pack` — passed locally, including the fresh-checkout artifact lifecycle. Its new
  checkout's package-manager installs run offline against the warmed package cache and local packed
  artifacts. The existing artifact setup install retains its prior package dependency resolution.
- Command flags were checked against the built CLI `init`, `install`, `sync`, and `doctor` help.
- GitHub Actions and merged-PR lookup could not yet be inspected: `gh` could not connect to
  `api.github.com`. Linux Node 24, macOS Node 22, and Windows Node 22 were not reproducible locally.

R090 completion and the transition to `R100-03 — measured behavior evidence` remain pending until
the actual PR Actions jobs are inspected and green. No packages were published.

## R070-02 — Add typed capability exclusions

Status: complete on `feat/typed-capability-exclusions`.

Behavior delivered:
- Added optional typed `exclude` configuration for Skills, MCP servers, Tools, Hooks and Agents.
- Exclusions validate against declarations from selected built-in or local packs, reject wrong kinds,
  stale names and enable/exclude contradictions, and preserve shared provenance.
- Added `configure --exclude kind:name` / `--include kind:name`, interactive exclusion selection,
  orphan cleanup after pack removal, effective resolution filtering, explain output, and safe sync
  pruning through the existing manifest ownership rules.
- Kept synthesized `agentyx-project-context` intentionally non-excludable and updated the schema,
  README, CLI README and packaged smoke lifecycle.

Verification:
- `pnpm check` — passed; 60 test files and 695 tests, with typecheck and all workspace builds.
- `pnpm eval:skills` — passed; 11 scenarios.
- `pnpm smoke:pack` — passed; packaged configure/exclude/include/sync lifecycle across Codex,
  Claude and Kimi, including owned-file pruning and unrelated-file preservation.

## R070-03 — Doctor local readiness contract

Status: complete on `feat/doctor-local-readiness`.
Starting main commit: `970dd4f`.

Behavior delivered:
- Added additive `ready` / `not-ready` / `unknown` states for configuration, installation
  convergence and locally inspectable prerequisites while preserving global Doctor status and
  `doctor --check` semantics.
- Active stdio MCP launchers, referenced `env`/HTTP-header variable names, selected Tools and
  Agentyx hook runtime availability now contribute local-prerequisite diagnostics. Disabled and
  excluded capabilities remain out of scope.
- Added structured MCP diagnostics for missing commands, missing environment references and
  provider scope/transport incompatibility. Provider parse/planning failures are reported without
  crashing and leave installation readiness unknown.
- Hardened executable lookup for project-relative commands, Windows PATH delimiters and PATHEXT
  candidates. Doctor remains read-only, offline and does not execute MCP commands.
- Documented that local readiness does not verify MCP startup, package downloads, connectivity,
  authentication, authorization, provider trust or semantic correctness. Extended packaged smoke
  coverage for pending, converged and missing-local-prerequisite states.

Files changed:
- `packages/cli/src/commands/doctor.ts`
- `packages/core/src/project/executable.ts`
- `packages/adapters/src/errors.ts`
- Doctor/core tests and packaged smoke assertions
- README, compatibility and roadmap documentation

Verification:
- `pnpm check` — passed; 61 test files and 703 tests.
- `pnpm eval:skills` — passed; 11 scenarios.
- `pnpm smoke:pack` — passed; packaged readiness assertions passed across Codex, Claude and Kimi.
- Changeset: `.changeset/bright-doctors-readiness.md` (minor fixed release group).

Limitations: local validation did not reproduce the GitHub Actions Linux Node 22/24, macOS Node 22
and Windows Node 22 matrix; no packages were published and R070-04 remains next.

Next task: R070-04 — validate the complete selection/readiness workflow


## R060-01 — Validate the pending onboarding release

Status: complete
Commit: working tree (branch `feature/session-start-hooks`)
Prerequisites checked: inspected baseline (`main` at `0.5.0`, `.changeset/spotty-agents-onboard.md`
pending)

Behavior delivered:
- Confirmed by source trace + existing tests that all onboarding acceptance criteria already hold:
  `init --install` reaches installed skills via the same `executeInstall` path as `agentyx install`;
  scripted `init` without `--install` writes config only and prints an actionable next command; a
  shared `.agents/skills` directory is not treated as proof of a specific provider; an existing
  skill file produces a `conflict`, not an overwrite; the packaged binary resolves built-in assets
  outside the checkout.
- Closed the one real gap: added a regression test proving that cancelling the interactive install
  prompt (after already confirming config creation) writes nothing to disk.
- Ran `pnpm smoke:pack` live to confirm the packaged-binary asset path (previously only inspected,
  not executed in this session).

Files changed:
- `packages/cli/test/init-command.test.ts`

Verification:
- `pnpm vitest run packages/cli/test/init-command.test.ts` — 10/10 passed.
- `pnpm smoke:pack` — passed (`Pack smoke passed in <tmp dir>`).
- No production code changes; no new Changeset needed (the existing `spotty-agents-onboard.md`
  already covers the onboarding behavior itself).

Compatibility / migration: none.

Remaining work: none.

Next task: R061-01

## R061-01 — Correct doctor readiness using the existing report shape

Status: complete
Commit: working tree (branch `feature/session-start-hooks`)
Prerequisites checked: R060-01 complete

Behavior delivered:
- `agentyx doctor` no longer reports `healthy` while skills or config are still unwritten. Added
  three warning diagnostics: `installation_pending` (pending create/update operations),
  `no_targets_configured` (zero configured targets), `required_tool_missing` (an active tool whose
  executable is not on `PATH`; never fires for a disabled optional tool). `status`/`--check`
  semantics are unchanged — these are additive `diagnostics` entries that `statusOf` already rolls
  up correctly.
- Fixed the existing test that asserted `healthy` with 7 pending creates and nothing installed; it
  now asserts the correct `warnings` status and diagnostic. Confirmed the existing "stays healthy
  after a real install" test still passes unmodified.
- Confirmed `summarizeInstallPlans` already deduplicates skill+MCP+hook operations by path+content
  in one pass (roadmap step 5); no change needed there.

Files changed:
- `packages/cli/src/commands/doctor.ts`
- `packages/cli/test/doctor-command.test.ts`

Verification:
- `pnpm vitest run packages/cli/test/doctor-command.test.ts` — 23/23 passed.
- Manual scratch-project cycle: `doctor` warns pre-install (`--check` exits 1), reports `healthy`
  post-install (`--check` exits 0), `doctor --hook` is silent when healthy.
- Changeset: `.changeset/warm-doctors-report.md` (patch, `@agentyx/cli`).

Compatibility / migration: a project that previously read `healthy` from `doctor` with a pending
install or a missing required tool will now see `warnings`; `--check` in CI already treated warnings
as failing, so this closes a gap CI should have caught rather than introducing a new failure mode.

Remaining work: none.

Next task: R062-01

## R062-01 — Audit and fix demonstrated lifecycle defects

Status: complete
Commit: working tree (branch `feature/session-start-hooks`)
Prerequisites checked: R061-01 complete

Behavior delivered:
- **Fixed a confirmed defect**: a local skill's `SKILL.md` that is itself a symlink pointing outside
  its configured skill directory was read and parsed transparently. The containing directory was
  already verified real; the file leaf was not. Now rejected with `LocalSkillDirectoryError`,
  verified against a real `symlink()` in a unit test and a live scratch-project attempt through the
  built CLI (confirmed the pointed-to content is never read).
- **Audited and closed with no behavior change**: `collectInstallConflicts` only scans
  `operations`/`deletions`, not `mcpOperations`/`hookOperations` — traced this to be safe by
  construction (`planMcp`/`planHooks` always plan with `force: true`, so an MCP/hook *write* can
  never be `"conflict"`; only a deletion can, and that already routes through `deletions`). Added a
  regression test locking in the invariant so a future change can't silently reopen the reporting
  gap.
- **Investigated and classified as in-tolerance, not fixed**: Codex's TOML round trip
  (`@iarna/toml`) strips comments and normalizes numeric literal style (`1.0` → `1`) on unrelated
  content. The roadmap's own wording permits unrelated entries to survive "even when their
  formatting changes legitimately" — this is exactly that, not a value-loss bug. Documented the
  limitation on `renderCodexMcpConfig` and added a test pinning the accepted boundary (values
  survive; comments and exact numeric formatting do not) rather than hand-rolling a surgical
  TOML text-preserving editor for a low-risk, already-scoped limitation.
- **Closed two untested-but-fine gaps** with regression tests: MCP/hook config file mtimes are
  unchanged on a no-op reinstall, and `.agentyx.lock.json` is byte-identical across two consecutive
  installs of the same configuration.

Files changed:
- `packages/core/src/config/project.ts`
- `packages/core/test/config-project.test.ts`
- `packages/adapters/src/mcp-rendering.ts`
- `packages/adapters/test/mcp-rendering.test.ts`
- `packages/adapters/test/planner.test.ts`
- `packages/adapters/test/executor.test.ts`

Verification:
- `pnpm vitest run` (full workspace) — 442/442 passed.
- `pnpm check` — biome, typecheck, tests, build all passed.
- Live scratch-project symlink-escape attempt through the built CLI: rejected, exit 1, secret
  content never read.
- Changeset: `.changeset/short-donuts-hunt.md` (patch, `@agentyx/core`).

Compatibility / migration: a project with a symlinked `SKILL.md` escaping its configured skill
directory will now fail to load instead of silently reading arbitrary file content. No other
observable change.

Remaining work: none.

Next task: R070-01 (0.7.0, not started)

Release status: not published. All three tasks above, plus the unrelated `hooks` feature (see
`.changeset/quiet-hooks-bootstrap.md`) and the pre-existing onboarding changeset
(`.changeset/spotty-agents-onboard.md`), sit on `feature/session-start-hooks` awaiting push and PR.

## R080-01 — Deliver Project Context & Project Graph

Status: complete
Commit: working tree
Prerequisites checked: package manifests report `0.7.0`; CLI/core/adapters layering and Zod-only
core confirmed. R070-01 through R070-04 are not recorded complete and their features are absent;
the graph/context implementation uses existing project-loading and install lifecycles without them.

Behavior delivered:
- Added optional project identity, direct semantic relations, ownership, and explicit internal
  context to `.agentyx.json`; old parsed configurations retain their previous shape.
- Preserved conservative context setup: interactive init offers only locally declared common
  package scripts under a detected package manager, leaves all choices unchecked, and never runs
  them; non-interactive init does not synthesize context.
- Added core text, JSON, Mermaid, and deterministic dependency-free SVG projections plus project
  context Skill rendering.
- Added `graph`, `graph show`, and `graph owner`; SVG writes only to a new in-project output path.
- Routed one canonical project-context Skill through existing provider adapters and manifest
  lifecycle. Claude, Codex, and Kimi destinations were verified byte-identical.
- Expanded the 0.8 roadmap to Project Context & Project Graph and added a generic example fixture.

Files changed:
- `packages/core`, `packages/cli`, `packages/core/schema/agentyx.schema.json`
- `README.md`, `packages/cli/README.md`, `docs/roadmap/README.md`,
  `docs/roadmap/0.8-project-context.md`, `examples/project-graph/.agentyx.json`
- `.changeset/curvy-pigs-plan.md`

Verification:
- `pnpm format` — passed.
- `pnpm check` — passed; 48 test files and 491 tests, with typecheck and all workspace builds.
- Core build followed by schema regeneration — passed; committed schema parity test passed.
- `pnpm smoke:pack` — passed in an external temporary project, including graph formats/queries,
  SVG output, install, packaged template loading, and provider Skill byte equality.
- Direct packed CLI review showed text, JSON, Mermaid, SVG, `show`, `owner`, and install output.

Compatibility / migration: project/context fields are optional. Legacy configs do not gain new
serialized fields. No remote access or automatic relation inference was added.

Remaining work: none for 0.8. The separate unfinished 0.7 roadmap remains unimplemented and should
be resolved before beginning 0.9.

Next task: R090-01, after deciding how to reconcile the incomplete 0.7 roadmap with the 0.8 release.
Release status: not published; Changeset prepares the minor release.

## R100-01 — Concrete provider + platform compatibility evidence

Status: complete. CI on PR #108 passed: Linux Node 22 and Node 24 (full gate and pack smoke), macOS
Node 22 and Windows Node 22 (packed-CLI smoke)
Starting commit: `1203324` (`main`, packages at `0.13.0`)
Prerequisites checked: R090-04 is not recorded in this log, but current source already ships the
lock, frozen install and migration behavior it describes. The task was executed against the 0.13.x
contract, so it also covers hooks, project agents, `configure`/`sync` and Doctor observability, which
the original R100-01 text predates.
Provider documentation verified: 2026-10-10 (Codex, Claude Code, Kimi Code; sources in
[docs/compatibility.md](../compatibility.md)).

Behavior and evidence delivered:
- Added the dated compatibility document: per-provider matrix, exact managed destinations, agent
  access mapping, MCP rendering, observability flags, trust behavior, platforms and exit behavior,
  keeping "provider supports", "Agentyx supports" and "Agentyx declines" apart.
- Added `packages/adapters/test/compatibility.test.ts` (31 tests): destinations, official-host
  references, byte-identical Skills for all built-ins across targets, Codex TOML / Claude and Kimi
  Markdown agent formats, read-only and workspace-write tool/sandbox mapping, shared `.agents`
  ownership and prune, MCP and hook lifecycles per provider (install, update, prune, uninstall with
  user entries preserved), observability flags, pre-agent manifest loading and sync, and an empty
  `$HOME` for every operation.
- Extended `pnpm smoke:pack`: runs on Windows-safe process spawning (no `.cmd` shim, no shell), runs
  the packed CLI with `$HOME` pointed at an empty directory, checks the bin entry, compares the
  packaged Skill and agent directories to source, parses `recommend`/`resolve`/`configure --dry-run`/
  `sync --dry-run`/`doctor` JSON, asserts exit codes (missing and invalid config, unknown target,
  invalid configure mutation, sync conflict, `doctor --check`), and runs a clean three-provider
  lifecycle: init, sync, config-only change leaves provider files untouched, dry-run, sync, Doctor
  convergence, no-op second sync, removing the Kimi target, disabling an agent, uninstall.
- CI: new `platform-smoke` job (macOS and Windows, Node 22, `pnpm smoke:pack`); the existing Linux
  `check` job already runs the full gate and the pack smoke on Node 22 and 24.

Compatibility corrections:
- Codex MCP `env` and Kimi MCP `env`/`headers` received the environment variable *name* as a literal
  value. Codex now uses the documented `env_vars` forwarding (a rename fails with
  `unsupported_mcp_env_reference`); Kimi documents no reference mechanism, so none is written.
- `capabilities.mcp.transports` was declared but never enforced; an undeclared transport now fails
  with `unsupported_mcp_transport`.
- Codex references pointed at `developers.openai.com/codex/*` (permanent redirect) and Claude's MCP
  reference at `docs.anthropic.com`; both now point at the current official pages.
- `uninstall --help` omitted agents.

Files changed:
- `packages/adapters/src/{built-in,errors,index,mcp-rendering,planner}.ts`
- `packages/adapters/test/{compatibility,mcp-rendering}.test.ts`, `packages/cli/test/target-command.test.ts`
- `packages/cli/src/commands/uninstall.ts`, `packages/cli/scripts/pack-smoke.mjs`
- `.github/workflows/ci.yml`, `docs/compatibility.md`, `docs/roadmap/{README,0.10-validation,progress}.md`
- `.changeset/calm-env-refs.md` (patch; the packages are one fixed group)

Verification (local, macOS, Node 22.23.1):
- `pnpm check` — passed (647 tests, 56 files; biome, typecheck, build).
- `pnpm eval:skills` — passed (8 scenarios; validates the suite, not agent quality).
- `pnpm smoke:pack` — passed.
- Dogfood with the built CLI, read-only: `doctor`, `configure --dry-run`, `sync --dry-run` ran against
  this repository. Root desired state was not changed. They report the repository's own checkout as
  not converged (2 blocked destinations for repository-development Skills, 36 files to create), which
  predates this task.
- Not run locally: Node 24, Linux, Windows. Those were covered by the PR #108 CI jobs, which passed.

Not covered, by design: whether any provider loads or uses what Agentyx writes (R100-03/R100-04); live
MCP connections; Kimi project-local hooks (provider is user-level only); SSE MCP.
Remaining unsupported or unverified: Kimi MCP env/header references; Kimi inheritance of the host
environment (undocumented); Claude Skill-use payload field name and Codex `enabled`/`env = {}` keys
(not spelled out in the pages read); Codex agent sandbox can be raised by live parent overrides.
Changeset: needed, because MCP rendering for Codex and Kimi changed (patch).

Next task: R100-02 — stale-plan and partial-failure hardening. Agentyx is not claimed 1.0-ready.
Release status: not published.

## Correction — R070 and R090 are not implemented (2026-10-11)

A source audit of `main` at 0.13.1 found that the R100-01 entry above is wrong where it says the lock,
frozen install and migration behavior of R090 "already ship". The historical text is kept as written.
Current source shows:

- R090 is **not** implemented: the manifest format is still version 1, and there is no
  `install --frozen`, no `doctor --locked` and no `install --migrate-lock`.
- R070 is **not** implemented: there was no `resolve --explain` and no typed `exclude` configuration.

R100-01 itself (the compatibility matrix and platform smoke) stands; only its prerequisite claim was
false. The prerequisite chain is therefore resumed at R070-01 before R100-03, R090 or any 1.0 claim.
This correction is documentation only and needs no Changeset.

## R100-02 — Stale-plan and partial-failure hardening

Status: complete. Merged as PR #110 (`dd5dc46`, implementation `ec06aa0`). CI on PR #110 passed:
Linux Node 22 and Node 24, packaged smoke on macOS Node 22 and Windows Node 22.
Starting commit: `3769a92` (packages at `0.13.1`)

Delivered:
- Stale-plan protection: every planned write or deletion records the destination state it observed
  and the executor revalidates it; a mismatch fails with `stale_install_plan`.
- Preflight validation before the first write, and just-in-time validation before each change.
- Bounded `--force`: it can resolve a recorded conflict but never overwrites or deletes a file that
  changed after planning, including user edits to `.mcp.json` and `.claude/settings.json`.
- Incomplete-install semantics: a failure after earlier changes fails with `incomplete_install`,
  listing completed and not-applied paths; the lock is committed only after every provider change
  succeeded. `configure --sync` keeps these codes.
- Atomic lock replacement through a same-directory temporary file and a rename.

Verification: 669 tests at the time; local validation passed; PR CI green as listed above.

Current limitations: installation as a whole is not atomic; there is no rollback; concurrent
installers are not supported; external mutation of `.agentyx.lock.json` between planning and writing
is not locked.

Changeset: `.changeset/steady-plan-state.md` (patch) is still pending, not yet released.
Roadmap reconciliation: R100-02 is recorded here after the fact; the next prerequisite resumed is
R070-01.

## R070-01 — Resolution provenance and explain output

Status: complete locally; PR CI pending at the time of writing.
Starting commit: `dd5dc46` (`main`, packages at `0.13.1`)
Why now: R100-02 was completed before its R070/R090 prerequisites were found to be missing (see the
correction above); this resumes the chain at its first task.

Delivered:
- `explainAgentyxResolution(resolved, packRegistry)` in `@agentyx/core` (`config/explain.ts`), with
  Zod schemas for the entry and a typed origin (`pack` or `project-context`). Pure: no filesystem, no
  second resolution, no terminal formatting. Entries carry kind, name, origins, activation, active
  and reason (`default`, `explicitly-enabled`, `optional-disabled`, `project-context`). `excluded`
  is not modelled; exclusions are R070-02.
- One provenance source: the explanation derives from `deriveCapabilityProvenance`, the helper Doctor
  already uses, which now also covers `agent`. The synthesized `agentyx-project-context` Skill is
  recognized as a Skill no pack contributes and is attributed to project context, never to a pack.
- Resolution fix found while doing this: provenance treated a capability as default when any pack
  declares it default, but the MCP/tool/hook/agent collectors kept the first pack's activation. They
  now agree (default wins, position kept), so an optional-then-default shared capability is active.
  No built-in pack mixes activations; this affects local packs.
- Doctor: footprint gains `agents: { active, declared }`. Agents are excluded from utilization like
  hooks, so they are never "used", "unused" or dormant, and existing Skill/MCP/tool semantics are
  unchanged.
- CLI: `resolve --explain` (grouped text) and `resolve --explain --json` (`{ resolution,
  explanation }`; `resolution` is the unchanged `resolve --json` object). Plain `resolve` and
  `resolve --json` are untouched. Explicit pack arguments keep bypassing project packs; `--enable`
  applies as before. Output has identifiers and selection metadata only.
- README example, help text, roadmap 0.7 implementation note, packed-CLI smoke for `--explain` and
  `--explain --json` (default Skill, project context, disabled/enabled optional MCP, agent).

Tests: `config-explain.test.ts` (default, optional disabled/enabled, shared, mixed activation, agent,
project context, local pack, ordering, schema), `resolve-explain.test.ts` (explicit mode, config mode
with local pack and context, JSON compatibility), an Agent utilization regression, an updated tool
collector test.
Verification (local, macOS, Node 22.23.1): `pnpm check` passed (685 tests, 60 files), `pnpm eval:skills`
passed (8 scenarios), `pnpm smoke:pack` passed.
Changeset: `.changeset/explain-resolution.md` (minor); `steady-plan-state.md` (patch) left in place.
Compatibility: additive CLI/JSON output; the only behavior change is the mixed-activation fix above.

Remaining: R070-02 (typed exclusions), R070-03, R070-04, then R090 and the rest of R100. R090 and
R100-03 are not ready; Agentyx is not claimed 1.0-ready. Not published.

Next task: R070-02 — typed exclusions.

## R070-04 — Workflow validation and release closeout

Status: complete by cumulative evidence from PR #117 and PR #119; no production gap was found.
The feature releases 0.16.0 and 0.17.0 already consumed their Changesets, so this documentation-only
closeout needs no additional Changeset.

Evidence:
- PR #117 added typed capability exclusions, `configure --exclude` / `--include`, explain output,
  safe sync pruning and packaged selection lifecycle coverage.
- PR #119 added structured Doctor readiness checks, documented the local-check/runtime boundary and
  passed its CI validation, with packaged readiness coverage across Codex, Claude and Kimi.
- Current source provides `resolve --explain`, typed exclusions, `sync --dry-run`, safe owned-state
  convergence, conflict preservation, structured Doctor readiness, workflow documentation and
  packaged smoke coverage. Legacy configurations remain valid and require no R070 migration.

R070 is complete. Next implementation task: R090-01.

## R090-01 — Version-2 manifest model and deterministic resolution snapshot

Status: complete. PR #121 CI passed across Linux Node 22/24 and macOS/Windows Node 22 packaged smoke.
Starting commit: `0f6930f` (`main`, `@agentyx/cli`, `@agentyx/core` and `@agentyx/adapters` at `0.17.0`).

Delivered:
- Added explicit Zod-backed `InstallManifestV1`, `InstallManifestV2` and discriminated
  `InstallManifest` types. Both reuse the existing ownership entries; v2 requires nullable
  `resolution`, and ownership helpers consult only `entries`.
- Added the provider-neutral `ResolutionSnapshot` contract for exact CLI version, canonical config
  hash, deterministic targets and effective Skill, MCP, Tool, Hook and Agent entries with hashes and
  provenance. Project context is the generated `agentyx-project-context` Skill; typed exclusions
  affect config hashing/effective selection; optional-disabled resources are absent from arrays.
- Added recursive canonical JSON hashing with `$schema` exclusion and set semantics for targets,
  enabled names and exclusion lists. Skills hash `formatSkillMarkdown` bytes; MCP hashes retain only
  env/header references, never environment values; no checkout paths or runtime observations enter.
- Added structured deterministic snapshot comparison for version, config, targets and all modern
  capability kinds without exposing bodies or secrets.
- Moved CLI version lookup to a packaged-metadata helper. Normal install/sync remains a v1 writer;
  transitional mutations of a manually supplied v2 lock invalidate a non-null snapshot.
- Modernized the 0.9 roadmap and added packed version/v1-writer smoke assertions.

Changeset: `.changeset/reproducible-lock-snapshot.md` (minor fixed group).
Verification: `pnpm check` passed — 62 test files and 721 tests; `pnpm eval:skills` passed — 11
scenarios; `pnpm smoke:pack` passed — packed CLI version and v1 lock assertions included.
GitHub Actions: PR #121 workflow `38565550707` passed `check (node 22)`, `check (node 24)`,
`packaged smoke (macos-latest, node 22)` and `packaged smoke (windows-latest, node 22)`.
Local limitations: the GitHub Actions Linux Node 22/24, macOS Node 22 and Windows Node 22 matrix
was not reproduced locally; the escalated packaged smoke used the current macOS/Node environment.
No packages were published. R090-02 remains deliberately out of scope.

Next task: R090-02 — persist complete snapshots and implement explicit v1 migration.

## R090-02 — Persist complete snapshots and explicit v1 migration

Status: implemented and locally validated; PR CI result is recorded in the PR.
Starting commit: `200f776` (`main`; `@agentyx/core`, `@agentyx/adapters`, `@agentyx/cli` at `0.18.0`).

Delivered:
- Version 2 is the default writer. A run is **complete** only with no pack arguments, `--target`,
  `--enable`, `--skill`, `--mcp`, `--select`, `--skills-only` or `--mcp-only`; `--force`/`--prune`
  are application policy and do not make it partial. `install`, `sync`, `init --install` and
  `configure --sync` (all through `executeInstall`) write a complete `ResolutionSnapshot` built by
  `createResolutionSnapshot` from the same `ResolvedAgentyxConfig` that drove planning, stamped with
  `cliVersion`. Every other mode writes v2 `resolution: null`, invalidating any earlier snapshot.
  Retained stale ownership stays in `entries` only; the snapshot holds the desired harness.
- Executor remains the only lock writer. `applyInstallPlans` takes `commit: ManifestCommitIntent`
  (`v2-complete`, `v2-incomplete`, `preserve-version`) and an explicit `projectDir`, so zero-plan runs
  can commit. The lock is committed last through the unchanged atomic temp-file + rename; an
  existing lock whose content equals the intended one is not rewritten (bytes and mtime preserved),
  while snapshot-only changes do write. An empty-ownership lock is kept only for a complete snapshot
  (a reviewed empty harness); otherwise it is removed. Stale-plan and incomplete-install semantics
  are unchanged; a failed final write leaves the previous lock.
- `loadInstallManifestState` (core) reports `present` next to the manifest; `loadInstallManifest`
  is unchanged for other callers.
- Legacy v1: `install`/`sync` (including partial installs) refuse before planning or writing with
  `legacy_lock_requires_migration`; `--dry-run` still previews and reports migration `required`.
  `configure --sync` keeps the new desired config and prints migration guidance.
- `install --migrate-lock` (no `sync` flag): rejected with `lock_migration_requires_full_project`
  when combined with any override (before prompts), `legacy_lock_missing` without a lock,
  `lock_migration_not_needed` for v2. It is a real full-project convergence with v1 entries as the
  only ownership evidence; edited or unmanaged destinations conflict and nothing is committed.
  `--dry-run` writes nothing. `--force` keeps its existing bounded meaning.
- Uninstall: full uninstall removes the lock; partial v2 uninstall keeps v2 and nulls `resolution`;
  v1 uninstall works without migration and stays v1. Doctor reads v1, complete v2 and null v2 and is
  unchanged.
- Reporting: install JSON gains an additive `lock` object (`present`, `currentVersion`,
  `nextVersion`, `migration`, `resolution`, `invalidated`); text ends with a one-line `Lock:` status.
  No snapshot content is printed.
- Fixture: `packages/cli/test/fixtures/lock-v1` is a real v1 project (Skill, Agent, MCP and Hook
  entries) generated with the v1 writer; it is excluded from Biome so recorded hashes stay exact.
- Smoke: `pnpm smoke:pack` now asserts a v2 complete lock stamped with the packed version, byte-identical
  lock after a second sync, refusal of `sync` on v1, dry-run immutability and packaged migration.

Changeset: `.changeset/persist-v2-lock-migration.md` (minor fixed group).
Verification (local): `pnpm check` passed — 64 test files, 773 tests; `pnpm eval:skills` passed — 11
scenarios; `pnpm smoke:pack` passed; scratch lifecycle outside the checkout (fresh v2 + no-op sync,
v1 dry-run + migration, edited-file migration refusal with the v1 lock byte-identical) passed.
Known limitations: concurrent installers are still unsupported (no file locking); `--frozen` and
`doctor --locked` are not implemented. The GitHub Actions matrix was not reproduced locally.

Next task: R090-03 — locked comparison and frozen installation.

## R090-03 — Locked comparison and frozen installation

Starting point: `main` at `3d186f0de6ae255c0fe50966b6d8c452e218266a`, packages at 0.19.0 (R090-01/02
merged). Branch `feat/locked-doctor-frozen-install`.

- `doctor --locked` (opt-in, read-only, no network or processes): builds the current snapshot through
  the shared `createCurrentProjectResolutionSnapshot` (`packages/cli/src/snapshot.ts`, also used by
  install) and compares with core's `compareResolutionSnapshots`. Doctor JSON gains an always-present
  `reproducibility` `{ checked, state, differences }`; states: `not-checked`, `matching`, `mismatch`,
  `missing-lock`, `legacy-lock`, `snapshot-unavailable`, `unavailable` (invalid or missing current
  config). Differences are the safe categories only (no hashes or bodies). Diagnostics:
  `locked_manifest_missing`, `locked_manifest_legacy`, `locked_resolution_missing`,
  `locked_resolution_mismatch` (all errors, so exit 1 without `--check`), plus
  `locked_inputs_unavailable` when nothing else already reports an error. A matching snapshot does not
  imply installation readiness. The exact CLI version is part of the contract. `--hook --locked` is
  rejected (`doctor_hook_locked_conflict`); ordinary Doctor is unchanged.
- `install --frozen` (no `sync --frozen`): full-project only; rejects packs, `--target`, `--enable`,
  `--skill`, `--mcp`, `--select`, `--skills-only`, `--mcp-only`, `--force`, `--prune`,
  `--migrate-lock` and target removal (`frozen_mode_conflict`) before prompting or writing;
  `--dry-run`/`--json` allowed. Requires a v2 lock with a complete snapshot (`frozen_lock_missing`,
  `frozen_lock_legacy`, `frozen_resolution_missing`), compares the snapshot before planning
  (`frozen_resolution_mismatch`, with structured differences), then uses the real planner and
  `validateFrozenPlans` (adapters): any ownership outside the desired selection or recorded targets
  fails (`frozen_stale_ownership`); unowned or hash-mismatching resources fail
  (`frozen_restore_not_owned`); updates, conflicts, deletions and any Agent/MCP/Hook creation or change
  fail (`frozen_installation_change_required`). The only write is creating an absent, lock-owned Skill
  whose recorded hash equals the canonical content.
- Lock invariance: new `ManifestCommitIntent` `{ kind: "read-only" }` makes the executor skip the lock
  entirely (bytes and mtime unchanged on no-op, restore and failure). Executor preflight, containment
  and just-in-time validation still apply (`stale_install_plan` wins a race).
- JSON: install reports gain `frozen { requested, snapshot, restorableSkills, lockChanged }` for frozen
  runs only. README documents both commands; help text added.
- Tests: 66 files, 829 tests (`locked-frozen.test.ts`, `adapters/test/frozen.test.ts`, updated wiring
  tests); `pnpm check`, `pnpm eval:skills` (11 scenarios) and `pnpm smoke:pack` (locked success, frozen
  restore with lock byte equality, mismatch rejection) passed locally. Scratch lifecycle outside the
  checkout (match, missing-Skill restore with lock bytes+mtime unchanged, config change refused, edited
  shared MCP config refused with the edit kept) passed.
- Changeset: `.changeset/locked-doctor-frozen-install.md` (minor, fixed group).
- Limitations: only missing Skills are restored; no concurrent-installer locking; the GitHub Actions
  matrix (Linux 22/24, macOS and Windows smoke) is not reproducible locally.

Next task: R090-04 — publish/document the complete reproducibility workflow and final artifact checks.
