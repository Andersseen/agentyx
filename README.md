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
| `angular`       | framework   | Modern Angular APIs, signals, architecture, testing            |
| `efficiency`    | efficiency  | Context-efficient exploration, output, iteration, verification |
| `agentic`       | workflow    | Brainstorming, planning, debugging, parallel and review flows  |
| `testing`       | engineering | Test level choice, doubles, end-to-end scope, flaky tests      |
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
- `playwright`: browser automation MCP, declared by `testing`.
- `chrome-devtools`: performance tracing and page inspection MCP, declared by `performance` and
  `accessibility`.
- `sentry`: production issue and stack trace MCP, declared by `observability`.
- `supabase`: project schema and log MCP, declared by `data`. Reads `SUPABASE_ACCESS_TOKEN` from the
  environment.
- `github`: repository, issue and pull-request MCP, declared by `git`.

Remote MCP servers are declared without credentials so the agent performs its own authorization
flow. Agentyx never writes a token into a provider configuration file.

Agentyx never downloads binaries, runs installers, edits PATH, or installs third-party runtime
Skills for these capabilities.

## Usage

Run Agentyx directly from npm; a global installation is not required:

```sh
pnpm dlx @agentyx/cli init \
  --pack technical \
  --pack typescript \
  --pack angular \
  --target codex \
  --target kimi \
  --yes

pnpm dlx @agentyx/cli doctor
pnpm dlx @agentyx/cli install --dry-run
pnpm dlx @agentyx/cli install
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

Removing a pack from `.agentyx.json` does not by itself remove what it installed. Ask for it:

```sh
pnpm dlx @agentyx/cli install --prune           # remove managed files nothing resolves any more
pnpm dlx @agentyx/cli install --prune --dry-run # see what that would remove first
```

`uninstall` removes everything the manifest records and leaves `.agentyx.json` alone, so the project
can be reinstalled afterwards. `--target <id>` limits it to one provider; a file two providers share
in `.agents/skills` is only removed once both are gone.

Provider MCP configuration is shared with you, so Agentyx never claims the whole file: pruning and
uninstalling remove only the server entries Agentyx added, and the file itself is deleted only when
Agentyx created it and nothing is left in it.

`doctor` reports all of this — files that are stale, edited since install, or not Agentyx's to write.

## Configuration

`.agentyx.json` fields:

| Field     | Type       | Default | Meaning                                      |
| --------- | ---------- | ------- | -------------------------------------------- |
| `$schema` | `string`   | none    | Optional JSON Schema path or URL             |
| `packs`   | `string[]` | `[]`    | Capability packs selected for the project    |
| `enable`  | `string[]` | `[]`    | Optional capabilities activated explicitly   |
| `targets` | `string[]` | `[]`    | Coding-agent providers to install into       |
| `skillDirectories` | `string[]` | none | Project-relative roots containing local Skills |
| `localPacks` | `Pack[]` | none | Project-owned packs composed from known Skills |
| `trustedSources` | `TrustedSource[]` | none | Pinned local checkouts of known external sources |

Unknown packs and unknown enabled capabilities fail with explicit Agentyx errors.

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
