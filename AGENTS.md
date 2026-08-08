# Agnox — agent instructions

Instructions for AI coding agents working **on this repository**. This is not Agnox product
configuration — Agnox does not generate or read this file.

## What this project is

Agnox is a provider-agnostic CLI for defining reusable development environments for coding agents.
The current scope is deliberately narrow: a configuration model (`.agnox.json`), a stack definition
model, a built-in stack registry, and stack resolution.

## Commands

```sh
pnpm install                  # install workspace dependencies
pnpm check                    # biome + typecheck + test + build — the gate before any hand-off
pnpm test                     # vitest run (whole workspace)
pnpm vitest run packages/core # single package
pnpm typecheck
pnpm format                   # biome check --write .
pnpm build

pnpm agnox resolve angular            # run the built CLI (requires pnpm build first)
pnpm --silent agnox resolve --json    # --silent keeps pnpm's banner out of stdout
```

Tests import from source via the `@agnox/core` alias in `vitest.config.ts`, so `pnpm test` does
**not** need a build. The `agnox` script does — it runs `packages/cli/dist/index.mjs`.

## Layering

```
packages/core        domain: config schema/loader/resolver, stack schema/registry/resolver/errors
packages/cli         Commander program and terminal output only
packages/adapters    provider adapters — placeholder, do not build on it yet
examples/angular     .agnox.json fixture, referenced by core and cli tests
```

Dependencies point one way: `cli → core`, `adapters → core`. Core depends on `zod` and nothing else.

## Hard rules

1. **`@agnox/core` must not import Commander, `@clack/prompts`, `chalk`, or any terminal code.** If
   a change needs terminal output in core, the design is wrong.
2. **Agnox is provider agnostic.** Never introduce `CodexStack`, `ClaudeStack`, or any concept that
   couples a stack to a provider. `targets` stays an open list of strings — do not turn it into a
   closed enum. Provider-specific behaviour goes to adapters, later.
3. **Zod is the source of truth for types.** Infer with `z.infer` / `z.input`; never maintain a
   hand-written interface next to a schema.
4. **Stacks are data.** New stacks are entries in `builtInStacks`. Resolution logic must not grow a
   branch per stack.
5. **Domain errors, not strings.** Extend `AgnoxError` (`packages/core/src/errors.ts`) and give it a
   stable `code`. One inheritance level — no error hierarchies.
6. **No premature abstraction.** No repositories, service containers, DI, factories, or plugin
   systems. Plain functions and plain objects.
7. **Never silently repair invalid configuration.** Throw a descriptive error.
8. **Do not implement the future roadmap.** Skills, MCP integration, provider adapters, project
   auto-detection, codebase memory, token budgets, remote registries, plugins, npm registry
   integration, an update system, and an init wizard are all out of scope until asked for.

## Code conventions

- ESM with `NodeNext`: relative imports end in `.js` even when the file is `.ts`.
- `verbatimModuleSyntax` — type-only imports need `import type`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Indexed access is
  `T | undefined`; handle it instead of using `!`.
- Do not hand-format. Biome owns formatting (100 columns, 2 spaces); run `pnpm format`.
- `packages/core/src/index.ts` is a pure barrel. Export only APIs a consumer genuinely needs.

## Testing conventions

- Tests live in `packages/<name>/test/*.test.ts`.
- CLI behaviour is tested through `runResolveCommand()`, which returns a string. **Never assert on
  ANSI escapes or spawn the binary in a unit test.**
- Filesystem tests use `mkdtemp(join(tmpdir(), "agnox-"))` and clean up in `afterEach`.
- Every bug fix gets a regression test.

## Two things that will bite you

- **The committed JSON Schema.** `packages/core/schema/agnox.schema.json` is generated from the Zod
  model and a test asserts they match. After changing `config/schema.ts`, run
  `pnpm --filter @agnox/core run build && pnpm --filter @agnox/core run schema`.
- **The generator reads `dist`.** `scripts/generate-schema.mjs` imports the built output, not the
  source, so the build must run first.

## Before handing work back

Run `pnpm check` and report the real result. If something fails, fix it or say plainly what is
broken and why. Do not report success on an unverified change.
