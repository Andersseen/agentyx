# Agnox — agent instructions

Instructions for AI coding agents working **on this repository**. This is not Agnox product
configuration — Agnox does not generate or read this file.

## What this project is

Agnox is a provider-agnostic CLI for defining reusable development environments for coding agents.
The current scope is deliberately narrow: a configuration model (`.agnox.json`), a stack definition
model, a built-in stack registry, stack resolution, skills — provider-agnostic instruction files
that stacks contribute and Agnox resolves — and provider adapters that install those skills into a
project for Codex (`.agents/skills`) and Claude Code (`.claude/skills`). Installation is
project-local, plan-first, and limited to skill files.

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

## Workflow skills

Two recurring jobs have written-down procedures in [.agents/skills](.agents/skills). They are plain
Markdown and provider-neutral — read the file and follow it, whichever agent you are.

- [verify-agnox](.agents/skills/verify-agnox/SKILL.md) — read before handing back any change; it
  covers the CLI and schema checks `pnpm check` does not.
- [add-builtin-stack](.agents/skills/add-builtin-stack/SKILL.md) — read when adding, renaming or
  re-parenting a built-in stack.

Agents with a native skill mechanism reach the same files through a thin bridge in their own
directory; [.agents/README.md](.agents/README.md) explains how to add one for a provider that is
not wired up yet.

## Layering

```
packages/core        domain: config schema/loader/resolver, stack and skill
                     schema/registry/resolver/errors, SKILL.md parsing and serialization
packages/core/skills built-in SKILL.md files, published as package assets
packages/cli         Commander program and terminal output only
packages/adapters    adapter contract, adapter registry, Codex and Claude Code adapters,
                     install planning, filesystem executor
examples/angular     .agnox.json fixture, referenced by core, cli and adapter tests
```

Dependencies point one way: `cli → core`, `adapters → core`. Core depends on `zod` and nothing else.

## Hard rules

1. **`@agnox/core` must not import Commander, `@clack/prompts`, `chalk`, or any terminal code.** If
   a change needs terminal output in core, the design is wrong.
2. **Agnox is provider agnostic.** Never introduce `CodexStack`, `ClaudeStack`, `CodexSkill` or any
   concept that couples a stack or a skill to a provider. `targets` stays an open list of strings —
   do not turn it into a closed enum. Provider-specific behaviour lives in `@agnox/adapters`, and an
   adapter owns a *destination*, never skill content: the canonical `SKILL.md` comes from
   `formatSkillMarkdown` in core, so a provider-specific copy of a skill body is always a bug.
3. **Zod is the source of truth for types.** Infer with `z.infer` / `z.input`; never maintain a
   hand-written interface next to a schema.
4. **Stacks and skills are data.** New stacks are entries in `builtInStacks`; new skills are a
   `SKILL.md` file plus a name in `builtInSkillNames`. Resolution logic must not grow a branch per
   stack or per skill, and skill instructions never live in TypeScript string constants.
5. **Domain errors, not strings.** Extend `AgnoxError` (`packages/core/src/errors.ts`) and give it a
   stable `code`. One inheritance level — no error hierarchies.
6. **No premature abstraction.** No repositories, service containers, DI, factories, or plugin
   systems. Plain functions and plain objects.
7. **Never silently repair invalid configuration.** Throw a descriptive error.
8. **Installation plans and writes stay separate.** Planning reads; only `applyInstallPlan` writes.
   Agnox writes UTF-8 files inside the directory a target owns and nothing else — no deletes, no
   shell commands, no network, no `$HOME`, and no provider config file it did not generate.
9. **Do not implement the future roadmap.** MCP integration, further providers (Kimi, OpenCode,
   Cursor), global installs, project auto-detection, codebase memory, token budgets, remote
   registries, plugins, npm registry integration, uninstall and sync cleanup, an update system, and
   an init wizard are all out of scope until asked for.

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

## Three things that will bite you

- **The committed JSON Schema.** `packages/core/schema/agnox.schema.json` is generated from the Zod
  model and a test asserts they match. After changing `config/schema.ts`, run
  `pnpm --filter @agnox/core run build && pnpm --filter @agnox/core run schema`.
- **The generator reads `dist`.** `scripts/generate-schema.mjs` imports the built output, not the
  source, so the build must run first.
- **`packages/core/src/assets.ts` must stay directly under `src/`.** It locates the built-in
  `SKILL.md` files relative to `import.meta.url`, and it works only because `src/assets.ts` and the
  bundled `dist/index.mjs` sit at the same depth below the package root. `skills` is also listed in
  the package's `files`; drop either and skills break after publish, not in tests.

## Before handing work back

Run `pnpm check` and report the real result. If something fails, fix it or say plainly what is
broken and why. Do not report success on an unverified change.
