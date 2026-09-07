# Agentyx roadmap to 1.0

Status: proposed implementation plan. No product changes are implemented by this document.
Baseline inspected: 2026-09-07; package manifests report `0.5.0`.

## Product outcome

Agentyx 1.0 prepares a project-local coding-agent environment that is understandable,
reproducible, safe to change, and informed by the project's own working conventions.
It gives maintainers evidence about installation readiness and a small, documented body of
evidence about instruction quality. It does not promise identical behavior across models.

The primary user is a developer or small team using supported coding agents in repositories.
The first validation audience is TypeScript projects, including Angular and a TypeScript
monorepo. Installation remains usable in other repositories; automatic detection has a
documented, narrower scope.

Success means a developer can:

1. Start from a clean checkout and understand what will be installed.
2. Explain why each capability is selected and remove unwanted ones.
3. Share the project's commands, directory responsibilities, and constraints with their agents.
4. Recreate a reviewed installation with a pinned Agentyx release and a checked-in lock.
5. Diagnose missing installation and local prerequisites without guessing.
6. Remove Agentyx-managed content without damaging independently maintained content.

## Verified starting point

The repository already has composable packs, built-in and local skills, optional MCP and tool
selection, three adapters, interactive initialization, installation planning, conflict handling,
pruning, uninstall, JSON output, and a diagnostic command. Do not rebuild those features.

Important baseline details:

- `core`, `adapters`, and `cli` report `0.5.0` and belong to one Changesets fixed group.
- `.changeset/spotty-agents-onboard.md` already requests a minor release for onboarding changes.
  Those changes are present in source. Preserve that changeset; the first planned release is
  `0.6.0`, subject to the actual release history when work begins.
- `doctor` can report `healthy` when installation still has files to create. Its existing
  test explicitly accepts this state.
- Resolution deduplicates capabilities but does not expose complete contribution provenance.
- Project detection primarily checks root package-manager files, TypeScript, and Angular.
- The lock records managed paths and content hashes; it does not pin complete resolution inputs.
- Local skills support instruction-only content. Trusted-source inspection does not install
  resource-bearing collections or prove their instructions are safe.
- The evaluation script validates four scenario definitions and expected skill membership;
  it does not execute agents or assess their behavior.
- The assessment baseline passed `pnpm check`: 40 test files, 403 tests, types, and build.
  This is historical evidence, not permission to skip verification in later sessions.

Source anchors: [doctor](../../packages/cli/src/commands/doctor.ts),
[resolution](../../packages/core/src/config/resolver.ts),
[project loading](../../packages/core/src/config/project.ts),
[manifest](../../packages/core/src/manifest/schema.ts),
[evaluation](../../scripts/evaluate-skills.mjs), and
[release configuration](../../.changeset/config.json).

## Release sequence

Version numbers are milestones, not dates or promises that a release has been published.
SemVer allows `0.10.0` after `0.9.x`; do not compress validation into 1.0 to avoid that number.

| Release | User-visible outcome | Implementation sessions | Prerequisite |
| --- | --- | --- | --- |
| [0.6.0](0.6-onboarding-and-corrections.md) | Finish and validate the onboarding already in source | R060-01 | Baseline |
| [0.6.1](0.6-onboarding-and-corrections.md) | Doctor no longer calls incomplete installation healthy | R061-01 | R060-01 |
| [0.6.2, conditional](0.6-onboarding-and-corrections.md) | Fix demonstrated ownership or lifecycle defects | R062-01 | R061-01 |
| [0.7.0](0.7-explain-and-select.md) | Explain selection, exclude capabilities, report local readiness accurately | R070-01 to R070-04 | R061-01; any confirmed safety fix |
| 0.7.1, conditional | Correct regressions in 0.7 behavior only | Incident-specific task | 0.7.0 feedback |
| [0.8.0](0.8-project-context.md) | Carry explicit project facts into the installed environment | R080-01 to R080-03 | R070-04 |
| 0.8.1, conditional | Correct context rendering, detection, or lifecycle regressions | Incident-specific task | 0.8.0 feedback |
| [0.9.0](0.9-reproducibility.md) | Verify and restore a locked environment with explicit migration | R090-01 to R090-04 | R080-03 |
| 0.9.1, conditional | Correct migration or frozen-install regressions | Incident-specific task | 0.9.0 feedback |
| [0.10.0](0.10-validation.md) | Validate compatibility, instruction quality, and real-project usability | R100-01 to R100-04 | R090-04 |
| 0.10.1+, conditional | Stabilize the release candidate scope | Findings from validation | R100-01 to R100-04 |
| [1.0.0](1.0-release.md) | Publish a documented, tested compatibility contract | R1000-01 to R1000-02 | All 1.0 gates pass |

Conditional patches are not empty releases. If no defect is demonstrated, skip that patch and
record the audit result. New flags, schema fields, or capabilities belong in a minor release.
Before 1.0, deliberate contract changes must still be described with migration instructions.

If the pending onboarding release ships under a different number, update this table and the
release metadata; preserve task IDs and dependency order. Do not rewrite existing changelogs.

## Scope boundaries

Keep the existing architecture: `cli -> core`, `adapters -> core`. Core remains terminal-free
and depends only on Zod. Adapters own provider destinations and formats, never different skill
instructions. Schema changes use Zod as the type source. New domain errors extend
`AgentyxError` directly and have stable codes.

Before 1.0, do not add:

- Agent execution, task scheduling, agent orchestration, session management, or a background daemon.
- A hosted control plane, accounts, telemetry service, dashboard, or marketplace.
- Remote registry downloads, an automatic updater, global installs, or executable installation.
- A proprietary memory store, repository index, embeddings, or an LLM dependency in normal commands.
- Token-budget enforcement or claims of measured token savings without measurements.
- Additional providers or broad language detection as a substitute for validating existing ones.
- Automatic repair of user instructions, semantic contradiction detection, or instruction precedence
  enforcement across provider-specific instruction files.
- Execution of project commands by Agentyx, MCP connectivity probes, or OAuth management.
- Resource-bearing external skill installation. Keep existing local instruction-only support and
  trusted-source inspection honest about their limits.

Project context in 0.8 is an explicit extension of configuration, not a new agent runtime.
Reproducibility in 0.9 is an explicit extension of the existing lock, not a package registry.
Neither authorizes other roadmap ideas that remain excluded in `AGENTS.md`.

## How to use this plan in a development session

Read [the session playbook](session-playbook.md), then only the release file containing the next
task. Complete one task ID per session unless the user explicitly chooses a larger scope.
Every task has a prerequisite, bounded implementation steps, acceptance cases, and verification.
The roadmap is the chosen starting design; changes require a written reason based on repository
evidence. Do not silently introduce another subsystem to solve an implementation difficulty.

Use this prompt:

> Implement task R070-01 from docs/roadmap/0.7-explain-and-select.md. First read AGENTS.md and
> docs/roadmap/session-playbook.md. Confirm its prerequisites in the current source. Implement only
> this task, including its meaningful tests and documentation. Run the required verification and
> record the handoff in docs/roadmap/progress.md. Do not implement later task IDs or publish packages.

Replace the task ID and file path for the chosen session. Product code is authorized by that
future implementation request, not by the existence of this roadmap.

## Progress and evidence

There are 20 planned implementation/release sessions. Their size is a scope boundary, not a
time estimate. Split a task into suffixes such as `R090-02a` and `R090-02b` if it cannot produce
a reviewable, verified change in one session. Preserve its acceptance criteria and dependency edges.

Create `docs/roadmap/progress.md` in the first implementation session using the playbook template.
Keep all tasks pending until verified. A completed implementation is not a published release.
The final release requires both technical gates and user evidence; passing unit tests alone is
insufficient.
