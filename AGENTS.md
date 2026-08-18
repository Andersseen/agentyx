# Agentyx — agent instructions

Instructions for AI coding agents working **on this repository**. This is not Agentyx product
configuration — Agentyx does not generate or read this file.

## What this project is

Agentyx is a provider-agnostic CLI for defining reusable development environments for coding agents.
The current scope is deliberately narrow: a configuration model (`.agentyx.json`), pack and Skill
registries, provider-agnostic MCP definitions, pack/Skill/MCP resolution, optimization profiles,
project detection, `init`, `doctor`, and provider adapters that install into Codex
(`.agents/skills`), Claude Code (`.claude/skills`) and Kimi Code (`.agents/skills`). Installation is
project-local, plan-first, and covers Skill files plus project MCP configuration. It is also
reversible: `.agentyx.lock.json` records what was written, which is what `install --prune` and
`uninstall` act on.

## Commands

```sh
pnpm install                  # install workspace dependencies
pnpm check                    # biome + typecheck + test + build — the gate before any hand-off
pnpm test                     # vitest run (whole workspace)
pnpm vitest run packages/core # single package
pnpm typecheck
pnpm format                   # biome check --write .
pnpm build

pnpm agentyx init --help
pnpm agentyx doctor --help
pnpm agentyx resolve angular            # run the built CLI (requires pnpm build first)
pnpm --silent agentyx resolve --json    # --silent keeps pnpm's banner out of stdout
pnpm smoke:pack                       # pack artifacts and smoke-test the packaged CLI externally
```

Tests import from source via the `@agentyx/core` alias in `vitest.config.ts`, so `pnpm test` does
**not** need a build. The `agentyx` script does — it runs `packages/cli/dist/index.mjs`.

## Workflow skills

Recurring jobs have written-down procedures in [.agents/skills](.agents/skills). They are plain
Markdown and provider-neutral — read the file and follow it, whichever agent you are.

- [verify-agentyx](.agents/skills/verify-agentyx/SKILL.md) — read before handing back any change; it
  covers the CLI and schema checks `pnpm check` does not.
- [add-builtin-pack](.agents/skills/add-builtin-pack/SKILL.md) — read when adding, renaming or
  re-categorizing a built-in pack.
- [context-efficient-development](.agents/skills/context-efficient-development/SKILL.md) — read for
  non-trivial Agentyx work to keep exploration, commands and output focused.
- [navigate-agentyx](.agents/skills/navigate-agentyx/SKILL.md) — read when you need the repository map
  before deciding where a change belongs.
- [repo-ai-tooling](.agents/skills/repo-ai-tooling/SKILL.md) — read before broad exploration or noisy
  command loops; it covers RTK, codebase memory and MCP context discipline.
- [official-website-development](.agents/skills/official-website-development/SKILL.md) — read before
  building the official Agentyx website; it keeps product copy grounded and visual checks explicit.

Agents with a native skill mechanism reach the same files through a thin bridge in their own
directory; [.agents/README.md](.agents/README.md) explains how to add one for a provider that is
not wired up yet.

## Token-frugal tooling

This repository is expected to be workable by any coding agent without burning the full context
window on orientation. Prefer the shared Skills above over provider-specific memory. If `rtk` is on
PATH, use it for noisy commands such as tests, builds, diffs and searches, then fall back to the raw
command only when exact output is required. Use codebase-memory MCP, when configured, as a map for
package ownership and prior decisions; verify important claims in files before editing. Keep heavy
MCP tools scoped to the task, especially during website work where browser inspection can otherwise
swallow the conversation.

## Layering

```
packages/core        domain: config schema/loader/resolver, pack, skill, MCP and tool
                     schema/registry/resolver/errors, install manifest schema and loader,
                     SKILL.md parsing and serialization
packages/core/skills built-in SKILL.md files, published as package assets
packages/cli         Commander program and terminal output only
packages/adapters    adapter contract, adapter registry, provider adapters,
                     install planning, filesystem executor
examples/angular     .agentyx.json fixture, referenced by core, cli and adapter tests
apps/web             the official website; consumes no workspace package
```

Dependencies point one way: `cli → core`, `adapters → core`. Core depends on `zod` and nothing else.

## Hard rules

1. **`@agentyx/core` must not import Commander, `@clack/prompts`, `chalk`, or any terminal code.** If
   a change needs terminal output in core, the design is wrong.
2. **Agentyx is provider agnostic.** Never introduce `CodexPack`, `ClaudePack`, `CodexSkill` or any
   concept that couples a pack or a skill to a provider. `targets` stays an open list of strings —
   do not turn it into a closed enum. Provider-specific behaviour lives in `@agentyx/adapters`, and an
   adapter owns a *destination*, never skill content: the canonical `SKILL.md` comes from
   `formatSkillMarkdown` in core, so a provider-specific copy of a skill body is always a bug.
3. **Zod is the source of truth for types.** Infer with `z.infer` / `z.input`; never maintain a
   hand-written interface next to a schema.
4. **Packs and skills are data.** New packs are entries in `builtInPacks`; new skills are a
   `SKILL.md` file plus a name in `builtInSkillNames`. Resolution logic must not grow a branch per
   pack or per skill, and skill instructions never live in TypeScript string constants.
5. **Domain errors, not strings.** Extend `AgentyxError` (`packages/core/src/errors.ts`) and give it a
   stable `code`. One inheritance level — no error hierarchies.
6. **No premature abstraction.** No repositories, service containers, DI, factories, or plugin
   systems. Plain functions and plain objects.
7. **Never silently repair invalid configuration.** Throw a descriptive error.
8. **Installation plans and writes stay separate.** Planning reads; only `applyInstallPlan` and
   `applyInstallPlans` write. Agentyx writes UTF-8 files inside the directory or project config file a
   target owns, plus `.agentyx.lock.json` at the project root, and nothing else — no shell commands,
   no network and no `$HOME`.
9. **Agentyx only touches what it recorded.** `.agentyx.lock.json` names every managed path and hashes
   its content. A destination that is not in the manifest, or whose content no longer matches the
   hash, is a `conflict`: never overwritten, never deleted, unless `--force` says so. Deletion is
   restricted to manifest-recorded paths, uses `rm` on single files and non-recursive `rmdir` on the
   directories they leave behind, and never touches a provider MCP config file beyond the server keys
   Agentyx added. This is what makes the shared `.agents/skills` directory safe: the root
   `.agentyx.json` dogfoods Agentyx itself, and repository-development Skills live in the same
   directory as built-in ones.
10. **Do not implement the future roadmap.** OpenCode, Cursor, global installs, token budgets, remote
    registries, plugins, npm registry integration and an update system are all out of scope until
    asked for.

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
- Filesystem tests use `mkdtemp(join(tmpdir(), "agentyx-"))` and clean up in `afterEach`.
- Every bug fix gets a regression test.

## Three things that will bite you

- **The committed JSON Schema.** `packages/core/schema/agentyx.schema.json` is generated from the Zod
  model and a test asserts they match. After changing `config/schema.ts`, run
  `pnpm --filter @agentyx/core run build && pnpm --filter @agentyx/core run schema`.
- **The generator reads `dist`.** `scripts/generate-schema.mjs` imports the built output, not the
  source, so the build must run first.
- **`packages/core/src/assets.ts` must stay directly under `src/`.** It locates the built-in
  `SKILL.md` files relative to `import.meta.url`, and it works only because `src/assets.ts` and the
  bundled `dist/index.mjs` sit at the same depth below the package root. `skills` is also listed in
  the package's `files`; drop either and skills break after publish, not in tests.

## Before handing work back

Run `pnpm check` and report the real result. If something fails, fix it or say plainly what is
broken and why. Do not report success on an unverified change.
