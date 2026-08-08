<div align="center">

# Agnox

**Provider-agnostic tooling for coding-agent environments.**

[![CI](https://github.com/Andersseen/agnox/actions/workflows/ci.yml/badge.svg)](https://github.com/Andersseen/agnox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-green.svg)](.nvmrc)

</div>

Agnox lets a project describe its development environment once, in a way that is not tied to any
single coding agent. Today it implements the configuration model, stack resolution, and skills.
Installing what a stack resolves to into a specific agent is **not implemented yet**.

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
  "targets": ["codex", "claude", "kimi"]
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
  kimi

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

Resolution failures throw domain errors — `UnknownStackError`, `CircularStackDependencyError`,
`UnknownSkillError`, `DuplicateSkillError`, `InvalidSkillError`, `AgnoxConfigNotFoundError`,
`AgnoxConfigParseError`, `AgnoxConfigValidationError` — all extending `AgnoxError` with a stable
`code`.

## Packages

| Package                                     | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`@agnox/core`](packages/core)               | Configuration model, stacks, skills, resolution, JSON Schema |
| [`@agnox/cli`](packages/cli)                 | The `agnox` command-line interface                       |
| [`@agnox/adapters`](packages/adapters)       | Provider adapter foundations (placeholder)               |

## Not implemented yet

Agnox understands skills; it does not yet install them anywhere. Copying skills into an agent's
directory, provider adapters (Codex, Claude, Kimi, OpenCode), MCP integration, project
auto-detection, codebase memory, token budgets, remote and community registries, plugins, npm
registry integration, an update system, and an init wizard are all still to come.

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
