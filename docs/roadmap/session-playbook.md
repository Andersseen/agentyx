# Implementation session playbook

This is the common execution contract for every task in the [roadmap](README.md).
Read it with the repository's `AGENTS.md`; repository safety rules continue to apply.

## Start with a bounded task

1. Read the selected task and its release's design contract. Check prerequisites against source
   and `docs/roadmap/progress.md`; a checkbox without working code is not evidence.
2. Read the applicable repository skills: navigation when locating ownership, efficient
   development for non-trivial work, repo AI tooling before broad exploration, and verification
   before handoff. Website work also requires its website skill.
3. Inspect `git status`, package versions, pending changesets, and only the relevant source/tests.
   Preserve unrelated work. Follow RTK instructions when running shell commands.
4. State the task ID, intended behavior, and what will verify it. Do not load all release files,
   enumerate the entire repository, or delegate work unless session instructions allow it.
5. If a prerequisite is absent, implement the prerequisite only if it is in the authorized scope;
   otherwise report the exact dependency. Do not create speculative compatibility layers.

## Implementation rules

- Keep functions and data structures small and direct. Follow existing files before adding files.
- Maintain provider-neutral canonical skill content and the planning/writing separation.
- Install/uninstall filesystem changes belong in the adapters executor. Existing CLI `init`
  remains the explicit author of `.agentyx.json`; do not add config writes to the domain layer.
- Preserve unknown/unmanaged content. `--force` never authorizes path escape, invalid config,
  secret serialization, or rewriting a frozen resolution contract.
- Use domain errors and semantic tests. Do not assert terminal color escapes or add CLI process
  spawning to unit tests. Built-binary and packed-artifact checks belong in smoke tests.
- Add a regression test for each bug fix. Test observable outcomes and boundary conditions,
  not internal function call counts that merely mirror implementation.
- Commands marked read-only must not write config, the lock, provider files, or source skills.
- Examples in release documents describe future behavior. Do not claim a flag is available until
  its implementation and tests land.
- Product docs must say what is supported now. Link to the roadmap for proposals rather than
  presenting all future commands as current features.

## Common verification gate

Run focused tests while iterating. Before every code handoff, follow
[`verify-agentyx`](../../.agents/skills/verify-agentyx/SKILL.md) and complete `pnpm check`.
This includes formatting, types, tests, and build. The skill also specifies built-CLI resolution
and error checks; passing source tests does not replace those checks.

Additional checks are conditional on the touched surface:

| Change | Additional verification |
| --- | --- |
| Config Zod schema | Build core, regenerate the committed JSON Schema, verify matching tests |
| Install/planning/executor | Scratch-project install, second install, dry-run, edited conflict, prune, uninstall |
| Skill content, asset loading, packaging | `pnpm smoke:pack`; verify required assets in packed core |
| Published package behavior | Appropriate Changeset; use the existing fixed group |
| JSON or exit semantics | Command-function tests plus a focused built-CLI smoke check |
| Website content | Website skill's checks and visual verification if layout changes |
| Release candidate | Full platform/artifact/real-project evidence from the relevant release file |

Use `pnpm format` when formatting is needed; do not hand-format generated artifacts.
`pnpm check` is also required for a documentation-only handoff under this repository's rules;
a docs-only change does not need a Changeset.

If a check fails, report the failing command and cause. Fix failures caused by the task; do not
mark completion while an acceptance case is unverified. External provider trials and unavailable
platform checks stay explicitly pending. Do not invent test results or substitute unit tests for
runtime evidence.

Do not publish packages, push a release tag, or send third-party messages unless the implementation
session separately authorizes those actions. Preparing artifacts and release notes is sufficient
until publication is authorized.

## Handoff record

Create or update `docs/roadmap/progress.md` with one record per task. Keep the log short and
store detailed evaluation evidence in the evaluation directory defined by 0.10.

```markdown
## R070-01 — Resolution provenance

Status: pending | in progress | complete | blocked
Commit: <commit if available; otherwise working tree>
Prerequisites checked: <task IDs and evidence>

Behavior delivered:
- <observable result>

Files changed:
- <relative paths>

Verification:
- <command, actual pass/fail result, test count when available>
- <manual acceptance evidence if required>

Compatibility / migration:
- <effect, or none>

Remaining work:
- <specific blocker or none>

Next task: <ID>
Release status: not published | published <version with evidence>
```

Also provide a concise user-facing handoff: task completed, meaningful behavior, actual verification,
and any remaining limitations. Never mark the next task complete because it was partially scaffolded.
