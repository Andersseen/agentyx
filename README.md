<div align="center">

# Agnox

**Provider-agnostic tooling for coding-agent environments.**

[![CI](https://github.com/Andersseen/agnox/actions/workflows/ci.yml/badge.svg)](https://github.com/Andersseen/agnox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-green.svg)](.nvmrc)

</div>

Agnox lets a project describe its development environment once, in a way that is not tied to any
single coding agent. Today it implements the configuration model and stack resolution. Everything a
stack will eventually carry — skills, MCP tools, agents, provider adapters — is **not implemented
yet**.

> **Status: early development.** APIs will change. Nothing is published to npm yet.

## Concept

A **stack** is a composable definition of a development environment. Stacks extend other stacks, and
Agnox resolves the full inheritance chain in dependency-first order.

| Stack        | Extends      | Description                                       |
| ------------ | ------------ | ------------------------------------------------- |
| `core`       | —            | Baseline shared by every Agnox stack              |
| `typescript` | `core`       | TypeScript development environment                |
| `angular`    | `typescript` | Modern Angular development environment            |

```
resolveStacks(["angular"])  ->  core → typescript → angular
```

Stacks describe **development environments, not providers**. There is no `CodexStack` or
`ClaudeStack`; which agents you target is a separate axis (`targets`), and provider-specific
behaviour will live in adapters later.

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
core
typescript
angular
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
```

Add `--json` for machine-readable output. Use `pnpm --silent` so pnpm's own banner stays out of
stdout:

```sh
pnpm --silent agnox resolve angular --json
```

```json
{
  "requestedStacks": ["angular"],
  "resolvedStacks": ["core", "typescript", "angular"]
}
```

An explicit stack argument takes precedence over `.agnox.json` for stack selection. Unknown stacks,
circular inheritance, a missing file, malformed JSON, and schema violations all print a readable
message on stderr and exit with code 1.

## Library use

```ts
import {
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, profile, targets }
```

Resolution failures throw domain errors — `UnknownStackError`, `CircularStackDependencyError`,
`AgnoxConfigNotFoundError`, `AgnoxConfigParseError`, `AgnoxConfigValidationError` — all extending
`AgnoxError` with a stable `code`.

## Packages

| Package                                     | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`@agnox/core`](packages/core)               | Configuration model, stack model, resolution, JSON Schema |
| [`@agnox/cli`](packages/cli)                 | The `agnox` command-line interface                       |
| [`@agnox/adapters`](packages/adapters)       | Provider adapter foundations (placeholder)               |

## Not implemented yet

Skills, MCP integration, provider adapters, project auto-detection, codebase memory, token budgets,
remote registries, plugins, npm registry integration, an update system, and an init wizard. Stacks
currently carry metadata only.

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
