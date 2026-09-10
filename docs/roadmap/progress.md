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
