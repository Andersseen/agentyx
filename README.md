# Agentyx

Agentyx is a provider-agnostic CLI for giving coding agents the same project-local development
behavior across Codex, Claude Code, and Kimi Code.

You choose composable capability **packs**:

```json
{
  "packs": ["technical", "typescript", "angular", "efficiency", "agentic"],
  "enable": ["rtk"],
  "targets": ["codex", "kimi"]
}
```

Packs contribute provider-neutral capabilities:

- **Skills**: installed as native `SKILL.md` files, so agents load relevant instructions on demand.
- **MCP servers**: configured only when selected and active.
- **Local tools**: detected and reported by doctor; Agentyx does not auto-install executables.

## Packs

| Pack            | Category    | Purpose                                                        |
| --------------- | ----------- | -------------------------------------------------------------- |
| `technical`     | engineering | General engineering quality, API design, code review           |
| `typescript`    | language    | Strict, modeled, modern TypeScript                             |
| `rust`          | language    | Idiomatic Rust, filesystem safety, portable tests, Cargo checks |
| `angular`       | framework   | Modern Angular APIs, signals, architecture, testing            |
| `efficiency`    | efficiency  | Context-efficient exploration, output, iteration, verification |
| `agentic`       | workflow    | Brainstorming, planning, debugging, parallel and review flows  |
| `testing`       | engineering | Test level choice, doubles, end-to-end scope, flaky tests      |
| `ui-ux`         | design      | Product UI/UX, usability, interaction and visual verification  |
| `security`      | engineering | Input validation, secrets, dependencies, authorization         |
| `performance`   | engineering | Profiling, web vitals, database query performance              |
| `accessibility` | engineering | Semantic markup, ARIA patterns, keyboard navigation            |
| `refactoring`   | engineering | Safe restructuring, legacy code, dependency hygiene            |
| `documentation` | engineering | Technical writing, API reference, decision records             |
| `observability` | engineering | Structured logging, metrics and tracing, incident response     |
| `data`          | engineering | Schema design, migrations, transactional consistency           |
| `git`           | workflow    | Commit hygiene, branching, reviewable pull requests            |
| `devops`        | workflow    | CI pipelines, containers, deployment safety, infrastructure    |

Packs compose without inheritance, so cross-cutting engineering packs combine with technology
choices explicitly. If a project wants both TypeScript and Angular behavior, select both:

```json
{
  "packs": ["technical", "typescript", "angular"],
  "targets": ["codex", "claude"]
}
```

## Optional Capabilities

Some capabilities are useful but heavier. They are declared by packs but disabled until explicitly
enabled:

```json
{
  "packs": ["efficiency"],
  "enable": ["rtk", "codebase-memory"],
  "targets": ["codex"]
}
```

Current optional capabilities:

- `rtk`: Rust Token Killer executable, detected as `rtk` on PATH.
- `codebase-memory`: structural code-intelligence MCP backed by a persistent knowledge graph.
- `playwright`: browser automation MCP, declared optionally by `testing` and `ui-ux`. Runtime: may
  fetch a package on first launch.
- `chrome-devtools`: performance tracing and page inspection MCP, declared by `performance` and
  `accessibility`. Runtime: may fetch a package on first launch.
- `sentry`: production issue and stack trace MCP, declared by `observability`.
- `supabase`: project schema and log MCP, declared by `data`. Reads `SUPABASE_ACCESS_TOKEN` from the
  environment. Runtime: may fetch a package on first launch.
- `github`: repository, issue and pull-request MCP, declared by `git`.

Remote MCP servers are declared without credentials so the agent performs its own authorization
flow. Agentyx never writes a token into a provider configuration file.

For web-product work, compose the provider-neutral UI/UX guidance with the separate accessibility
and performance packs when those concerns apply:

```json
{
  "packs": ["technical", "typescript", "angular", "ui-ux", "accessibility", "performance"],
  "enable": ["playwright"],
  "targets": ["codex", "claude", "kimi"]
}
```

The `ui-ux` pack is useful without browser automation. Playwright is optional and improves rendered
verification when available; Agentyx does not claim that visual verification happened when browser
inspection was unavailable.

Agentyx never downloads binaries, runs installers, edits PATH, or installs third-party runtime
Skills for these capabilities. Some capabilities do launch a command that can — an MCP server
started through `npx` can fetch that package from the registry the first time a provider runs it.
That is a property of the command itself, not of Agentyx, and every server that runs one is marked
"may fetch a package on first launch" above; `agentyx mcp show <name>` and `agentyx pack show <pack>`
print the same distinction (`runtime: local` vs `runtime: may-download`) before you enable anything.

## Project agents

The `agentic` pack exposes optional native project agents. Enable the roles you want with
`agentyx configure --enable agentyx-reviewer --yes`, then run `agentyx sync`. Agentyx renders one
canonical provider-neutral definition through each provider adapter. Claude Code, Kimi Code, and
Codex CLI install their documented project-local formats; unsupported providers continue to use
Skills normally. Subagents isolate task context, but each may consume additional model tokens.
Agentyx defines the harness and does not orchestrate agents or call provider APIs. Review project
agent files in repositories you do not trust.

```json
{
  "packs": ["technical", "agentic"],
  "enable": ["agentyx-reviewer"],
  "targets": ["codex", "claude", "kimi"]
}
```

Provider references: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents),
[Kimi Code agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents.html),
[Codex CLI subagents](https://developers.openai.com/codex/multi-agent).

## Harness observability

`agentyx doctor` answers a practical question: is the harness you configured actually useful, or have
you piled up capabilities you rarely use?

- **Footprint, always.** From configuration alone, Doctor reports how many packs, Skills, MCP
  servers, local tools and hooks are active, and how many active MCP servers are low, medium or
  high *context cost*. Those are the qualitative `contextCost` labels each MCP server declares —
  they are never added up into a token figure. A capability two packs both contribute counts once.
- **Pack breadth.** Configured packs are compared with what project detection recommends. This is
  informational: packs such as `security`, `documentation` or `efficiency` are often deliberate
  workflow choices that `package.json` cannot reveal.
- **Observed activity, when a provider can show it.** With the `efficiency` pack, Agentyx installs
  three small project-local hooks (`observe-session-start`, `observe-session-end`,
  `observe-tool-use`) for Claude Code (`.claude/settings.json`) and Codex (`.codex/hooks.json`). Each
  runs `agentyx hook observe`, which records *that* a session started or ended and *which* Agentyx
  Skill or MCP server was used. Repeated hooks are silent and fail open.

What the numbers mean:

- `observed in 9 / 12 observable sessions (75%)` is an **observed session rate**: sessions where
  Agentyx saw activity for a pack or capability, divided by sessions that gave it enough telemetry to
  see it. It is **not** a token, cost or context-window share, and not a measure of usefulness. Every
  JSON percentage carries its numerator and denominator.
- *No observed evidence* is not *known unused*. Codex documents no Skill usage signal, so Skills there
  are *unobservable*, and a pack made of Skills reports "usage unavailable" rather than zero. Pack
  evidence is `strong`, `partial` or `unavailable`; only strong evidence gets a percentage.
- A **dormant candidate** is an active MCP server that a provider can reliably show, with at least 10
  observable sessions (`DORMANCY_MIN_SESSIONS` in `@agentyx/core`; a heuristic, not a scientific
  constant) and no observed use. For a high-context server, Doctor adds an informational note
  suggesting you consider disabling it. Doctor never changes `.agentyx.json`.

Usage is **configuration-aware**:

- Each session records a harness baseline at its start: an opaque fingerprint of what is *installed*
  (from `.agentyx.lock.json`: Skills, MCP servers and hooks per target, plus the providers'
  observability contract). Changing the installed harness starts a fresh baseline.
- Only current-baseline sessions count toward rates, dormant candidates and context sizes. Enabling
  Playwright after 20 sessions does not make it look dormant: those sessions are historical and
  ignored (Doctor shows how many). A session with no recorded start, or an undetermined or
  conflicting baseline, is never negative evidence either.
- While `.agentyx.json` is ahead of what is installed, Doctor pauses negative recommendations until
  `agentyx sync` makes them converge. A provider whose observer hooks are not installed (for
  example Codex with inline `config.toml` hooks) contributes no negative evidence.
- The store is ephemeral analytics, versioned independently of your configuration. It is now
  `usage-v2.jsonl`; an old `usage-v1.jsonl` is left untouched and ignored.

Privacy, in full:

- Local only. No network requests, no telemetry, no accounts, no cloud storage.
- Metadata only. A record holds a timestamp, the provider id, an opaque hash of the session id, an
  event, an Agentyx Skill/MCP id, a session-start baseline fingerprint and — when Claude Code reports it — a context size. It never holds
  prompts, responses, source code, file names, tool arguments or output, shell commands, secrets or
  environment variables; the schema has nowhere to put them.
- Never in your commits. State lives at `<git dir>/agentyx/usage-v2.jsonl` (the real git directory
  is resolved for worktrees and submodules). Git ignores it, so `git status` stays clean and
  `.gitignore` is untouched. Outside a Git checkout nothing is recorded; Agentyx never writes to
  `$HOME`. It keeps the 50 most recent sessions and at most 256 KiB.

Provider support:

| Provider | Project hooks | Session lifecycle | MCP use | Skill use | Context size |
| --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | provider-reported, when sent |
| Codex | yes (`.codex/hooks.json`) | yes | yes | not documented | no |
| Kimi Code | no | no | no | no | no |

Codex requires you to review and trust project hooks (`/hooks`); Agentyx never bypasses that, so Doctor
reports Codex hooks as *configured, user review may be required* rather than active. If
`.codex/config.toml` already defines inline `[hooks]`, Agentyx adds no second `hooks.json` (Codex
warns about two sources in one layer) and says so. Kimi Code supports hooks, but only in user-level
`~/.kimi-code/config.toml`; Agentyx refuses to mutate `$HOME`, so Kimi gets the full static analysis
and runtime observation is reported as unavailable.

The observer hooks run `npx --no-install agentyx ...`, so `@agentyx/cli` must be a project dependency.
Skill use is recorded for Agentyx's built-in Skills only. RTK runs through shell commands, which
Agentyx will not store or guess at, so RTK use is not observed.

## Discovery

Agentyx ships more packs and capabilities than any project needs. `recommend` reads this project's
`package.json`, `Cargo.toml` and a small set of known files — Dockerfile, CI workflow directory, workspace
markers — and suggests which built-in packs and optional capabilities fit, each with a reason:

```sh
pnpm dlx @agentyx/cli recommend
pnpm dlx @agentyx/cli recommend --json
```

This is deterministic detection, not an AI feature: no network request, no telemetry, and no LLM
call decides a recommendation. `recommend` never writes anything — no `.agentyx.json`, no installed
files, no enabled MCP server or hook. `init` uses the same engine to pick sensible defaults, but you
choose what's actually selected either way:

```sh
pnpm dlx @agentyx/cli recommend
pnpm dlx @agentyx/cli init
```

## Usage

Run Agentyx directly from npm; a global installation is not required:

```sh
pnpm dlx @agentyx/cli init
```

That is the whole first run. `init` detects the project's stack and the agents already used in the
checkout, offers them as defaults, and finishes by installing the skills into each one — so a first
run goes from nothing to installed without a second command.

The same flow, scripted:

```sh
pnpm dlx @agentyx/cli init \
  --pack technical \
  --pack typescript \
  --pack angular \
  --target codex \
  --target kimi \
  --yes \
  --install

pnpm dlx @agentyx/cli doctor
```

Without `--install`, `init` only writes `.agentyx.json` and tells you the install command to run.

Pick skills and MCP servers by hand instead of by pack, with a searchable list:

```sh
pnpm dlx @agentyx/cli install --select
```

Inspect packs:

```sh
pnpm dlx @agentyx/cli pack list
pnpm dlx @agentyx/cli pack show efficiency
```

Inspect trusted external sources:

```sh
pnpm dlx @agentyx/cli source list
pnpm dlx @agentyx/cli source show superpowers
pnpm dlx @agentyx/cli source inspect superpowers
```

Resolve the selected capabilities:

```sh
pnpm dlx @agentyx/cli resolve
pnpm dlx @agentyx/cli resolve technical typescript angular
pnpm dlx @agentyx/cli resolve efficiency --enable rtk --json
```

Explain where each capability comes from and why an optional one is or is not active:

```sh
pnpm dlx @agentyx/cli resolve --explain
pnpm dlx @agentyx/cli resolve testing --explain --json
```

`--explain` lists every declared Skill, MCP server, tool, hook and agent with the packs that
contribute it (or project context, for the generated `agentyx-project-context` Skill), whether it is
active, and whether it was a default or explicitly enabled. Optional capabilities that are not
enabled stay listed as inactive, so you can see why they are absent. It reads configuration only; it
does not report runtime usage (that is `agentyx doctor`).

Install into configured targets:

```sh
pnpm dlx @agentyx/cli install --dry-run
pnpm dlx @agentyx/cli install
```

Remove what Agentyx installed:

```sh
pnpm dlx @agentyx/cli uninstall --dry-run
pnpm dlx @agentyx/cli uninstall
```

Inspect project health:

```sh
pnpm dlx @agentyx/cli doctor
pnpm dlx @agentyx/cli doctor --json
pnpm dlx @agentyx/cli doctor --check # fail on warnings or errors, useful in CI
```

## Project-owned packs

Agentyx can compose its built-in catalogue with instruction-only Agent Skills checked into your
repository. A Skill root uses the minimal Agent Skills layout: one directory per Skill, each
containing `SKILL.md`.

```text
.agentyx/skills/
  team-review/SKILL.md
```

Reference the root and group its Skills into a local pack:

```json
{
  "packs": ["technical", "team"],
  "skillDirectories": [".agentyx/skills"],
  "localPacks": [
    {
      "name": "team",
      "category": "workflow",
      "description": "Our repository-specific review workflow.",
      "skills": ["team-review"]
    }
  ],
  "targets": ["codex", "claude"]
}
```

Directories must stay inside the project even after resolving symlinks. Agentyx reads them locally;
it never clones repositories or executes bundled code. This makes a pinned, reviewed vendor copy or
submodule a safe foundation for integrating third-party collections.

Collections that depend on bundled scripts, references, assets, hooks, or provider plugins need a
richer integration than copying `SKILL.md`. The security and compatibility policy for those sources
is documented in [Trusted sources](docs/trusted-sources.md).

## Trusted sources

Agentyx has an initial trusted-source registry for reputable external Skill/plugin projects whose
layout needs review before installation. The first source is
[Superpowers](https://github.com/obra/superpowers), a Codex plugin with planning, TDD, debugging and
delivery workflow Skills.

Keep the checkout inside the project and pin the reviewed ref:

```json
{
  "trustedSources": [
    {
      "name": "superpowers",
      "path": ".agentyx/sources/superpowers",
      "ref": "v5.1.0"
    }
  ]
}
```

Then inspect it locally:

```sh
pnpm dlx @agentyx/cli source inspect superpowers
```

This validates the known repository, plugin manifest, Skill names and resource presence. It does not
clone the repository, run hooks, execute scripts, or install resource-bearing Skills yet.

## Installation lifecycle

Agentyx records every file it writes in `.agentyx.lock.json` — the path, the targets that use it, and
a hash of the exact content installed. Commit it: it is what lets Agentyx tell its own files apart
from yours.

That record decides what Agentyx may touch:

- A destination Agentyx has no record of writing is a **conflict**. Nothing is written, the run fails,
  and the offending paths are listed. This is what keeps a directory such as `.agents/skills` safe to
  share with hand-written skills — including one that happens to carry the same name as a built-in
  Skill. Use `--force` to overwrite deliberately.
- A file Agentyx wrote but you have since edited is also a conflict. Agentyx will neither replace nor
  remove it.
- Everything else is Agentyx's to replace, so reinstalling an up-to-date project writes nothing.

The lock (version 2) holds two independent things:

- `entries` — **ownership**: the files and provider entries Agentyx wrote. Only these allow Agentyx
  to update or remove anything.
- `resolution` — the **reviewed harness snapshot**: the exact CLI version, a hash of the desired
  configuration and the effective Skills, MCP servers, tools, hooks and agents with their hashes. It
  never grants ownership. It is recorded by a complete config-driven `install`, `sync`,
  `init --install` or `configure --sync`, and is `null` after any partial run (explicit packs,
  `--target`, `--enable`, `--skill`, `--mcp`, `--select`, `--skills-only`, `--mcp-only`) or a partial
  `uninstall`. A later full `sync` records it again. Re-running an unchanged install leaves the lock
  file untouched.

Locks written by earlier versions (version 1) record ownership only. `doctor` and `uninstall` still
read them, but `install` and `sync` will not change a project until the lock is migrated through a
real, reviewed install of the whole `.agentyx.json`:

```sh
pnpm dlx @agentyx/cli install --migrate-lock --dry-run   # review; writes nothing
pnpm dlx @agentyx/cli install --migrate-lock
```

Migration is not a JSON conversion. It uses the existing ownership as evidence, so edited or
unmanaged files still conflict and are never adopted, and the version-1 lock is replaced only after
every change succeeded. It cannot be combined with pack arguments or other overrides. Agentyx does
not coordinate concurrent installers: run one at a time.

### Locked comparison and frozen installation

Two opt-in commands use the lock's `resolution` snapshot. Neither is a package manager.

```sh
pnpm dlx @agentyx/cli doctor --locked            # compare current inputs with the lock; read-only
pnpm dlx @agentyx/cli install --frozen --dry-run # preview what frozen mode would restore
pnpm dlx @agentyx/cli install --frozen
```

- `doctor --locked` compares `.agentyx.json`, the selected Skill sources and the **exact** CLI
  version with the locked snapshot. The JSON report gains `reproducibility` (`state`: `matching`,
  `mismatch`, `missing-lock`, `legacy-lock`, `snapshot-unavailable`, `unavailable`, plus safe
  `differences`). Any locked failure exits 1, with or without `--check`. A matching snapshot does not
  mean the installed files are complete: read `readiness.installation` for that. After upgrading the
  CLI, run a normal reviewed `sync` to record a new lock.
- `install --frozen` needs a complete version-2 lock whose snapshot equals the current inputs. It is
  full-project only (`--dry-run` and `--json` are the only companions). It may restore one thing: a
  missing Skill file the lock already owns, with the exact reviewed content. Edited, unowned, Agent,
  MCP and Hook state, stale ownership and deletions all fail; those need a normal reviewed `sync`.
  It never rewrites `.agentyx.lock.json`, uses no network and runs no commands.

`.agentyx.json` is the project's desired state. `.agentyx.lock.json` records the provider files and
entries Agentyx owns. Use `configure` to edit desired state, `sync` to converge installed state, and
`doctor` to inspect health, drift and harness evidence:

```sh
pnpm dlx @agentyx/cli init
pnpm dlx @agentyx/cli recommend
pnpm dlx @agentyx/cli configure
pnpm dlx @agentyx/cli sync --dry-run
pnpm dlx @agentyx/cli sync
pnpm dlx @agentyx/cli doctor
```

`configure` changes only the requested config fields. `sync` applies and prunes Agentyx-owned
provider state to match that config; it preserves unrelated provider settings and reports conflicts
for unmanaged or drifted files. `install` remains available for lower-level manual installation.
Doctor usage data is local evidence about installed harnesses, never desired state.

Packs are composable defaults. Tailor a selected pack with typed exclusions:

```json
{
  "packs": ["technical", "ui-ux"],
  "exclude": { "skills": ["api-design"], "mcpServers": ["playwright"] },
  "targets": ["codex", "claude"]
}
```

Use `agentyx configure --exclude skill:api-design --yes` or
`agentyx configure --include skill:api-design --yes`; `--include` removes an exclusion and does not
enable an optional capability. Exclusions are typed across Skills, MCP servers, tools, hooks and
agents. `resolve --explain` shows the excluded reason and provenance. Changing desired state alone
does not touch provider files; use `sync --dry-run` to preview, then `sync` to safely remove only
Agentyx-owned state.

`uninstall` removes everything the manifest records and leaves `.agentyx.json` alone, so the project
can be reinstalled afterwards. `--target <id>` limits it to one provider; a file two providers share
in `.agents/skills` is only removed once both are gone.

Provider MCP configuration is shared with you, so Agentyx never claims the whole file: pruning and
uninstalling remove only the server entries Agentyx added, and the file itself is deleted only when
Agentyx created it and nothing is left in it.

`doctor` separates configuration readiness, installed-state readiness and locally inspectable
prerequisites in its additive `readiness` JSON section. It checks local executable presence and
referenced environment-variable names for active capabilities; MCP startup, downloads, network
connectivity and authorization remain unverified.

## Project Graph

Repositories rarely live alone. A frontend may rely on a backend, auth service and design system
even when they are stored separately. Agentyx can describe those architectural relationships so
humans and coding agents know where responsibilities live. Project Graph is not a package dependency
graph; Agentyx 0.8 does not clone or index related repositories.

Add direct relationships to `.agentyx.json`:

```json
{
  "project": { "id": "web", "name": "Web", "owns": ["frontend"] },
  "relations": [
    {
      "id": "api",
      "name": "API",
      "type": "consumes",
      "role": "backend-api",
      "repository": "https://github.com/acme/api",
      "owns": ["backend-api"]
    }
  ]
}
```

```sh
agentyx graph
agentyx graph --json
agentyx graph --format mermaid
agentyx graph --format svg --output docs/project-graph.svg
agentyx graph show api
agentyx graph owner backend-api
```

Project identity, relationships, and the optional `context` facts generate one canonical
`agentyx-project-context` Skill. The existing adapters install identical Skill content for Claude,
Codex and Kimi. Repository and docs links are descriptive references; Agentyx does not fetch them,
call declared MCP servers, or infer relationships from package dependencies. Interactive `init` can
offer existing `check`, `test`, `build`, and `lint` scripts as project commands when one package
manager is clear; none are selected by default, and non-interactive init does not synthesize context.

## Configuration

`.agentyx.json` fields:

| Field     | Type       | Default | Meaning                                      |
| --------- | ---------- | ------- | -------------------------------------------- |
| `$schema` | `string`   | none    | Optional JSON Schema path or URL             |
| `packs`   | `string[]` | `[]`    | Capability packs selected for the project    |
| `enable`  | `string[]` | `[]`    | Optional capabilities activated explicitly   |
| `exclude` | `object` | none | Typed capabilities removed from selected packs |
| `targets` | `string[]` | `[]`    | Coding-agent providers to install into       |
| `skillDirectories` | `string[]` | none | Project-relative roots containing local Skills |
| `localPacks` | `Pack[]` | none | Project-owned packs composed from known Skills |
| `trustedSources` | `TrustedSource[]` | none | Pinned local checkouts of known external sources |
| `project` | `Project` | none | This repository's identity and owned capabilities |
| `relations` | `Relation[]` | `[]` | Direct semantic relationships to other projects |
| `context` | `Context` | none | Explicit commands, areas and constraints for its agents |

Unknown packs, enabled capabilities and excluded capabilities fail with explicit Agentyx errors.

## Architecture

The product boundary is:

```text
packs
  -> provider-neutral capabilities
  -> adapters
```

Adapters do not know about packs. They receive already-resolved Skills and MCP definitions and write
provider-specific project files. Agentyx keeps installation planning separate from filesystem
writes, and it only writes managed Skill files and managed MCP entries.

## Roadmap to 1.0

The [implementation roadmap](docs/roadmap/README.md) describes the proposed path from the current
release to 1.0, with versioned milestones, bounded session tasks, acceptance criteria, and release
gates. It prioritizes reliable diagnostics, explainable selection, project context, reproducibility,
and measured usefulness while keeping Agentyx a project-local CLI.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm eval:skills
pnpm e2e:web
```

Tests import core source through workspace aliases, so most unit tests do not require a build. The
CLI binary checks do require `pnpm build`.
