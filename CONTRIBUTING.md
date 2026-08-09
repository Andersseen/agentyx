# Contributing to Agentyx

Thanks for taking the time to contribute. This document covers everything you need to make a change.

## Requirements

- Node.js >=22 (see [.nvmrc](.nvmrc))
- pnpm 10.30.1 — `corepack enable` picks it up from `packageManager`

## Getting started

```sh
git clone https://github.com/Andersseen/agentyx.git
cd agentyx
pnpm install
pnpm build
pnpm test
```

## Repository layout

```
packages/core        domain layer: config model, stack model, skills, resolution
packages/cli         Commander CLI, terminal output
packages/adapters    adapter contract, Codex and Claude Code adapters, install planning
examples/angular     .agentyx.json fixture used by tests and docs
.agents/skills       provider-neutral workflow skills for agents working on this repo
```

## Architecture rules

These are the constraints that keep Agentyx extensible. A PR that breaks one of them will be asked to
change.

1. **`@agentyx/core` never imports Commander, `@clack/prompts`, or anything terminal-related.** All
   CLI concerns live in `@agentyx/cli`.
2. **Agentyx is provider agnostic.** There is no `CodexStack` or `ClaudeStack`. Stacks describe
   development environments; provider-specific behaviour belongs in adapters. The stack inheritance
   model must not know that providers exist, and an adapter owns a destination, never skill content
   — every provider installs the canonical `SKILL.md` that `formatSkillMarkdown` renders.
3. **Zod schemas are the source of truth.** TypeScript types are inferred with `z.infer` /
   `z.input`, never hand-written alongside a schema.
4. **Stack definitions are data.** New stacks go into the registry array, not into resolver logic.
5. **Errors are domain errors.** Throw a subclass of `AgentyxError` rather than a generic `Error` or a
   string, so callers can branch on `error.code`.
6. **Simple functions and plain objects.** No service containers, dependency injection, factories,
   or plugin abstractions until a concrete need forces one.
7. **Never silently recover from invalid configuration.** Report it.
8. **Installation is plan-first.** Planning reads and returns an `InstallPlan`; only the executor
   writes, only inside the directory a target owns, and only files Agentyx generated.

## Development workflow

```sh
pnpm check       # biome + typecheck + test + build (run this before pushing)

pnpm format      # biome check --write .
pnpm lint        # biome lint .
pnpm typecheck   # tsc --noEmit in every package
pnpm test        # vitest run
pnpm build       # tsdown in every package
pnpm clean       # remove dist/
```

Run the CLI against the built output:

```sh
pnpm build
pnpm agentyx resolve angular
pnpm --silent agentyx resolve angular --json
```

## Coding conventions

- ESM only. Relative imports carry the `.js` extension, even from `.ts` files (`NodeNext`).
- `verbatimModuleSyntax` is on: use `import type` for type-only imports.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Index access returns
  `T | undefined` — handle it rather than asserting.
- Formatting and lint are Biome's job. Do not hand-format; run `pnpm format`.
- Comments explain *why*, not *what*. Match the density of the surrounding file.

## Adding a built-in stack

1. Add the definition to `builtInStacks` in
   [packages/core/src/stack/registry.ts](packages/core/src/stack/registry.ts). Keep the description
   to one line. A stack may contribute `skills`; MCP tools and agents are not part of the model.
2. Extend the registry assertions in
   [packages/core/test/stack-registry.test.ts](packages/core/test/stack-registry.test.ts).
3. Add a resolution test in
   [packages/core/test/stack-resolver.test.ts](packages/core/test/stack-resolver.test.ts).

## Changing the configuration schema

`packages/core/schema/agentyx.schema.json` is generated from the Zod model and committed so it can be
published with `@agentyx/core`. After editing
[packages/core/src/config/schema.ts](packages/core/src/config/schema.ts):

```sh
pnpm --filter @agentyx/core run build
pnpm --filter @agentyx/core run schema
```

A test fails if the committed schema drifts from the Zod model, so this is not optional.

## Tests

- Tests live in `packages/<name>/test/*.test.ts` and run under Vitest.
- Test behaviour, not formatting. Never assert on ANSI escapes — CLI tests call
  `runResolveCommand()` and assert on the returned string.
- Every bug fix gets a regression test.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Add a changeset for any change that affects a published package:

  ```sh
  pnpm changeset
  ```

  Pick the packages and the bump (patch/minor/major) and describe the change in one sentence. Docs
  and CI-only changes do not need one.
- `pnpm check` must pass before you open the PR. CI runs the same commands on Node 22 and 24.
- Keep PRs focused. A refactor and a feature belong in separate PRs.

## Scope

Agentyx is early. The following are deliberately **not implemented yet**, and PRs adding them will be
declined until the groundwork lands: MCP integration, providers beyond Codex and Claude Code, global
installation into `$HOME`, project auto-detection, codebase memory, token budgets, remote
registries, plugins, npm registry integration, uninstall and sync cleanup, an update system, and an
init wizard.

Open an issue to discuss anything substantial before writing code.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
