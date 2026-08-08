<div align="center">

# Agnox

**Provider-agnostic tooling for coding-agent environments.**

[![CI](https://github.com/Andersseen/agnox/actions/workflows/ci.yml/badge.svg)](https://github.com/Andersseen/agnox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-green.svg)](.nvmrc)

</div>

Agnox lets a project describe its development environment once, in a way that is not tied to any
single coding agent, and installs it into the agents you actually use:

```
.agnox.json  ->  stacks  ->  skills  ->  provider adapter  ->  project-local files
```

Today that runs end to end for two targets — Codex and Claude Code — from one set of skill sources.

> **Status: early development.** APIs will change. Nothing is published to npm yet.

## Concept

A **stack** is a composable definition of a development environment. Stacks extend other stacks and
contribute **skills**, and Agnox resolves the full inheritance chain in dependency-first order.

| Stack        | Extends      | Skills                                              |
| ------------ | ------------ | --------------------------------------------------- |
| `core`       | —            | `planning`, `systematic-debugging`, `verification`   |
| `typescript` | `core`       | `typescript-modern`                                 |
| `angular`    | `typescript` | `angular-modern`                                     |

```
resolveStacks(["angular"])       ->  core → typescript → angular
resolveStackSkills(["angular"])  ->  planning, systematic-debugging, verification,
                                     typescript-modern, angular-modern
```

Stacks describe **development environments, not providers**. There is no `CodexStack` or
`ClaudeStack`; which agents you target is a separate axis (`targets`), and provider-specific
behaviour will live in adapters later.

## Skills

A **skill** is reusable instruction text for a coding agent — provider-independent, with no install
path, permissions, or provider metadata attached. The model is deliberately three fields:

```json
{
  "name": "typescript-modern",
  "description": "Modern TypeScript conventions - strict types, inference, small explicit APIs.",
  "content": "..."
}
```

Built-in skills live as `SKILL.md` files in
[packages/core/skills](packages/core/skills), one directory per skill, with YAML frontmatter for the
metadata and the Markdown body as the instructions:

```md
---
name: planning
description: Plan non-trivial work before editing, and keep small changes small.
---

Instructions...
```

The frontmatter is a small flat `key: value` subset of YAML, so `@agnox/core` keeps depending on
Zod alone. Anything richer is rejected rather than guessed at, and a malformed built-in skill is a
build failure, not a silently skipped file.

Resolution works on **identifiers only** — skill bodies are read when something asks for them, so
`agnox resolve` never pays for the instruction text. Skills are resolved in stack order, then
declaration order, de-duplicated by first occurrence.

## Requirements

- Node.js >=22
- pnpm 10.30.1 (`corepack enable`)

## Setup

```sh
pnpm install
pnpm build
```

## `.agnox.json`

A project describes itself with `.agnox.json` in its root directory:

```json
{
  "$schema": "./node_modules/@agnox/core/schema/agnox.schema.json",
  "extends": ["angular"],
  "profile": "balanced",
  "targets": ["codex", "claude"]
}
```

| Field     | Type                                    | Default      | Meaning                                                       |
| --------- | --------------------------------------- | ------------ | ------------------------------------------------------------- |
| `extends` | `string[]`                              | `[]`         | Stacks this project builds on                                  |
| `profile` | `"lean" \| "balanced" \| "autonomous"`  | `"balanced"` | How much autonomy the generated environment grants             |
| `targets` | `string[]`                              | `[]`         | Coding agents this project targets                             |

`targets` is an open list of strings, not an enum, so third-party adapters can add providers later
without a schema change.

Parent directories are not searched, and an invalid configuration is reported rather than repaired.
A working example lives in [examples/angular/.agnox.json](examples/angular/.agnox.json) — it is a
configuration fixture, not an Angular project.

## `agnox resolve`

Resolve a stack without needing a project configuration:

```sh
pnpm agnox resolve angular
```

```
Stacks
  core
  typescript
  angular

Skills
  planning
  systematic-debugging
  verification
  typescript-modern
  angular-modern
```

Resolve the current project's `.agnox.json`:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs resolve
```

```
Agnox configuration

Profile
  balanced

Targets
  codex
  claude

Stacks
  core
  typescript
  angular

Skills
  planning
  systematic-debugging
  verification
  typescript-modern
  angular-modern
```

Add `--json` for machine-readable output. Use `pnpm --silent` so pnpm's own banner stays out of
stdout:

```sh
pnpm --silent agnox resolve angular --json
```

```json
{
  "requestedStacks": ["angular"],
  "resolvedStacks": ["core", "typescript", "angular"],
  "skills": [
    "planning",
    "systematic-debugging",
    "verification",
    "typescript-modern",
    "angular-modern"
  ]
}
```

`resolve` prints skill identifiers, never skill contents, so its output stays cheap to hand to an
agent.

An explicit stack argument takes precedence over `.agnox.json` for stack selection. Unknown stacks,
unknown skills, circular inheritance, a missing file, malformed JSON, and schema violations all
print a readable message on stderr and exit with code 1.

## `agnox skill`

List the built-in skills:

```sh
pnpm --silent agnox skill list
```

```
planning
systematic-debugging
verification
typescript-modern
angular-modern
```

Read one, instructions included:

```sh
pnpm --silent agnox skill show angular-modern
```

```
angular-modern
Modern Angular conventions - standalone, signals, inject(), OnPush, zoneless.

# Modern Angular
...
```

`--json` gives the same skill as a `{ name, description, content }` document:

```sh
pnpm --silent agnox skill show angular-modern --json
```

An unknown skill prints a readable message on stderr and exits with code 1.

## `agnox target`

A **target** is a coding agent Agnox can install into. List them:

```sh
pnpm --silent agnox target list
```

```
codex
claude
```

`agnox target show <target>` adds the provider name and where it installs skills in the current
project:

```sh
pnpm --silent agnox target show codex
```

```
codex
Codex
.agents/skills (not present)
```

| Target   | Agent       | Project skill destination |
| -------- | ----------- | ------------------------- |
| `codex`  | Codex       | `.agents/skills`          |
| `claude` | Claude Code | `.claude/skills`          |

Both are the providers' own documented project-local conventions — Codex reads repository skills
from the vendor-neutral [`.agents/skills`](https://developers.openai.com/codex/skills), Claude Code
from [`.claude/skills`](https://code.claude.com/docs/en/skills). Installation is project-local only:
Agnox never writes to `$HOME`.

## `agnox install`

`install` resolves the project, turns the resolved skills into a plan per target, and writes it.
Always look first:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs install --dry-run
```

```
Agnox install (dry run)

codex -> .agents/skills
  create    .agents/skills/planning/SKILL.md
  create    .agents/skills/systematic-debugging/SKILL.md
  create    .agents/skills/verification/SKILL.md
  create    .agents/skills/typescript-modern/SKILL.md
  create    .agents/skills/angular-modern/SKILL.md

claude -> .claude/skills
  create    .claude/skills/planning/SKILL.md
  create    .claude/skills/systematic-debugging/SKILL.md
  create    .claude/skills/verification/SKILL.md
  create    .claude/skills/typescript-modern/SKILL.md
  create    .claude/skills/angular-modern/SKILL.md

Dry run: 10 to create, 0 to update, 0 unchanged. Nothing was written.
```

`--dry-run` runs the full resolution and produces the real plan; it just never touches the disk.
Drop it to install:

```sh
agnox install
```

```
Installed: 10 written, 0 unchanged.
```

Every skill is installed from one source: `@agnox/core` renders the canonical `SKILL.md` once, and
the adapters only decide where it goes, so the file under `.agents/skills` and the one under
`.claude/skills` are byte-identical. Re-running reports `unchanged` and writes nothing; editing an
installed file makes the next run report `update` and restore it.

Install into a specific agent, whatever `.agnox.json` says — `--target` is repeatable, applies to
that run only, and never edits the configuration:

```sh
agnox install --target codex
agnox install --target codex --target claude
```

A stack can be named directly, exactly as with `resolve`, which installs without a `.agnox.json` at
all. The configuration is then not read, so the target has to be explicit:

```sh
agnox install angular --target codex --dry-run
```

`--json` prints the plan and nothing else — identifiers, statuses and project-relative paths, never
skill bodies:

```sh
pnpm --silent agnox install core --target codex --json --dry-run
```

```json
{
  "dryRun": true,
  "stacks": ["core"],
  "skills": ["planning", "systematic-debugging", "verification"],
  "targets": ["codex"],
  "plans": [
    {
      "target": "codex",
      "name": "Codex",
      "skillsPath": ".agents/skills",
      "operations": [
        {
          "type": "write-file",
          "status": "create",
          "skill": "planning",
          "path": ".agents/skills/planning/SKILL.md"
        },
        {
          "type": "write-file",
          "status": "create",
          "skill": "systematic-debugging",
          "path": ".agents/skills/systematic-debugging/SKILL.md"
        },
        {
          "type": "write-file",
          "status": "create",
          "skill": "verification",
          "path": ".agents/skills/verification/SKILL.md"
        }
      ]
    }
  ],
  "summary": { "create": 3, "update": 0, "unchanged": 0 }
}
```

Agnox only manages `<destination>/<skill>/SKILL.md` for skills it resolved. Other skills, provider
settings and anything else in those directories are never read or written, a plan that would write
outside the destination is refused, and nothing is ever deleted. A target with no adapter, or an
installation with no target at all, prints a readable message on stderr and exits with code 1.

## Library use

```ts
import {
  builtInSkillRegistry,
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
  resolveStackSkills,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveStackSkills(["angular"]);
// ["planning", "systematic-debugging", "verification", "typescript-modern", "angular-modern"]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, skills, profile, targets }

builtInSkillRegistry.names; // identifiers, no file is read
builtInSkillRegistry.get("planning"); // { name, description, content }
```

`createSkillRegistry(sources)` builds an independent registry from `{ name, load }` sources, which
is the seam an external registry would use later.

Installation lives in `@agnox/adapters`, and planning is always separate from writing:

```ts
import { applyInstallPlans, builtInAdapterRegistry, planInstall } from "@agnox/adapters";
import { builtInSkillRegistry } from "@agnox/core";

const skills = ["planning", "angular-modern"].map((name) => builtInSkillRegistry.get(name));
const plans = await planInstall({ targets: ["codex", "claude"], projectDir, skills });
// one plan per target; no file has been touched

await applyInstallPlans(plans); // the only code that writes

builtInAdapterRegistry.ids; // ["codex", "claude"]
```

`createAdapterRegistry(adapters)` builds an independent registry, and `createSkillDirectoryAdapter`
turns `{ id, name, skillsDir }` into an adapter for any agent that reads
`<directory>/<skill>/SKILL.md` — the seam a third-party adapter would use.

Resolution and installation failures throw domain errors — `UnknownStackError`,
`CircularStackDependencyError`, `UnknownSkillError`, `DuplicateSkillError`, `InvalidSkillError`,
`AgnoxConfigNotFoundError`, `AgnoxConfigParseError`, `AgnoxConfigValidationError`,
`UnknownAdapterError`, `DuplicateAdapterError`, `MissingInstallTargetsError`, `InstallPathError` —
all extending `AgnoxError` with a stable `code`.

## Packages

| Package                                     | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`@agnox/core`](packages/core)               | Configuration model, stacks, skills, resolution, JSON Schema |
| [`@agnox/cli`](packages/cli)                 | The `agnox` command-line interface                       |
| [`@agnox/adapters`](packages/adapters)       | Adapter contract, Codex and Claude Code adapters, install planning |

## Not implemented yet

Agnox installs skills into Codex and Claude Code, project-locally, and nothing more. Still to come:
MCP integration, further providers (Kimi, OpenCode, Cursor), global installation into `$HOME`,
remote and community registries, token optimization, uninstall and sync cleanup, a plugin system,
project auto-detection, codebase memory, npm registry integration, an update system, and an init
wizard. `profile` is carried through resolution but does not change what is installed yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and the architecture rules that
keep Agnox provider agnostic. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), never
a public issue.

```sh
pnpm check   # biome + typecheck + test + build
```

## License

[MIT](LICENSE) © Andersseen
