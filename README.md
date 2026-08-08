# Agnox

Agnox is provider-agnostic tooling for coding-agent environments.

Status: early development. The repository currently implements the configuration model and stack
resolution only.

## Concept

A **stack** is a composable definition of a development environment. Stacks can extend other stacks,
and Agnox resolves the full inheritance chain in dependency-first order.

The built-in stacks are metadata only:

```
core          no parents
typescript    extends core
angular       extends typescript
```

Stacks describe development environments, not providers. Provider-specific behaviour will live in
adapters later.

## Requirements

- Node.js >=22
- pnpm 10.30.1

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

- `extends` — the stacks the project builds on. Defaults to `[]`.
- `profile` — `lean`, `balanced` or `autonomous`. Defaults to `balanced`.
- `targets` — the coding agents the project targets. Free-form strings, so third-party adapters can
  add providers later. Defaults to `[]`.

Parent directories are not searched, and an invalid configuration is reported rather than repaired.

A working example lives in [examples/angular/.agnox.json](examples/angular/.agnox.json). It is only
a configuration fixture, not an Angular project.

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

An explicit stack argument takes precedence over `.agnox.json` for stack selection.

## Library use

```ts
import {
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
} from "@agnox/core";

resolveStacks(["angular"]); // ["core", "typescript", "angular"]
resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
```

## Not implemented yet

Provider adapters, Skills, MCP installation, agents and optimization rules are **not implemented**.
Stacks currently carry metadata only.

## Development

```sh
pnpm agnox --help
pnpm agnox --version
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm check
pnpm clean
```

`packages/core/schema/agnox.schema.json` is generated from the Zod model. Regenerate it after
changing the configuration schema (a test fails if it drifts):

```sh
pnpm --filter @agnox/core run build
pnpm --filter @agnox/core run schema
```
