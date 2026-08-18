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
packages/core        domain layer: config schema, pack/skill/MCP/tool registries, resolution
packages/cli         Commander CLI, terminal output
packages/adapters    adapter contract, provider adapters, install planning and execution
examples/angular     .agentyx.json fixture used by tests and docs
.agents/skills       provider-neutral workflow skills for agents working on this repo
apps/web             official website
```

## Architecture rules

These are the constraints that keep Agentyx extensible. A PR that breaks one of them will be asked to
change.

1. **`@agentyx/core` never imports Commander, `@clack/prompts`, or anything terminal-related.** All
   CLI concerns live in `@agentyx/cli`.
2. **Agentyx is provider agnostic.** There is no `CodexPack` or `ClaudePack`. Packs describe
   development environments; provider-specific behaviour belongs in adapters. `targets` stays an
   open list of strings, and an adapter owns a destination, never skill content — every provider
   installs the canonical `SKILL.md` that `formatSkillMarkdown` renders.
3. **Zod schemas are the source of truth.** TypeScript types are inferred with `z.infer` /
   `z.input`, never hand-written alongside a schema.
4. **Packs and skills are data.** New packs go into the registry array, and new skills are
   `SKILL.md` assets plus registry names, not resolver branches.
5. **Errors are domain errors.** Throw a subclass of `AgentyxError` rather than a generic `Error` or a
   string, so callers can branch on `error.code`.
6. **Simple functions and plain objects.** No service containers, dependency injection, factories,
   or plugin abstractions until a concrete need forces one.
7. **Never silently recover from invalid configuration.** Report it.
8. **Installation is plan-first.** Planning reads and returns an `InstallPlan`; only the executor
   writes, only inside the directory or project config file a target owns, and only managed content
   Agentyx generated and recorded.

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

## Adding a built-in pack

1. Add the definition to `builtInPacks` in
   [packages/core/src/pack/registry.ts](packages/core/src/pack/registry.ts). Keep the purpose to one
   line. A pack may contribute default skills, default MCP servers, and optional MCP/tool
   capabilities.
2. Extend the registry assertions in
   [packages/core/test/pack-registry.test.ts](packages/core/test/pack-registry.test.ts).
3. Add a resolution test in
   [packages/core/test/pack-resolver.test.ts](packages/core/test/pack-resolver.test.ts).

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
declined until the groundwork lands: OpenCode, Cursor, global installation into `$HOME`, token
budgets, remote registries, plugins, npm registry integration, and an update system.

Open an issue to discuss anything substantial before writing code.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
