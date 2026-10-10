# Roadmap implementation progress

One record per task, in completion order. See [session-playbook.md](session-playbook.md) for the
template and verification requirements this log follows.

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

Status: complete for local verification; macOS, Windows and Node 24 results are pending the CI run of
this branch (`chore/1-0-compatibility-evidence`)
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
- Not run locally: Node 24, Linux, Windows. Do not treat those as passing until the CI jobs are green.

Not covered, by design: whether any provider loads or uses what Agentyx writes (R100-03/R100-04); live
MCP connections; Kimi project-local hooks (provider is user-level only); SSE MCP.
Remaining unsupported or unverified: Kimi MCP env/header references; Kimi inheritance of the host
environment (undocumented); Claude Skill-use payload field name and Codex `enabled`/`env = {}` keys
(not spelled out in the pages read); Codex agent sandbox can be raised by live parent overrides.
Changeset: needed, because MCP rendering for Codex and Kimi changed (patch).

Next task: R100-02 — stale-plan and partial-failure hardening. Agentyx is not claimed 1.0-ready.
Release status: not published.
