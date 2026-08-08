---
name: verify-agnox
description: Run the full Agnox verification pipeline before handing work back - formatting, typecheck, tests, build, and the CLI behaviour checks that pnpm check does not cover. Use after any change to packages/core, packages/cli, or the config schema.
---

# Verify an Agnox change

`pnpm check` covers formatting, types, tests and build. It does **not** exercise the built CLI, and
it does not catch a JSON Schema that has drifted from the Zod model. Run both halves.

## 1. The standard gate

```sh
pnpm check
```

This runs `biome check .` → `pnpm typecheck` → `pnpm test` → `pnpm build`, and stops at the first
failure. If Biome reports formatting problems, run `pnpm format` and re-run.

## 2. CLI behaviour

`pnpm check` builds the CLI but never runs it. These are the acceptance checks:

```sh
node packages/cli/dist/index.mjs resolve core         # -> core
node packages/cli/dist/index.mjs resolve typescript   # -> core, typescript
node packages/cli/dist/index.mjs resolve angular      # -> core, typescript, angular
node packages/cli/dist/index.mjs resolve angular --json

node packages/cli/dist/index.mjs skill list
node packages/cli/dist/index.mjs skill show planning
node packages/cli/dist/index.mjs skill show angular-modern --json

cd examples/angular && node ../../packages/cli/dist/index.mjs resolve
cd examples/angular && node ../../packages/cli/dist/index.mjs resolve --json
```

`resolve` prints a `Stacks` section and a `Skills` section, identifiers only — never skill contents.
Human output for the example project must be the `Agnox configuration` block with Profile, Targets,
Stacks and Skills sections. `--json` must print JSON and nothing else.

## 3. Error paths

Each of these must print a readable message on **stderr** and exit with code 1:

```sh
node packages/cli/dist/index.mjs resolve svelte        # unknown stack
node packages/cli/dist/index.mjs skill show nope       # unknown skill
(cd /tmp && node "$OLDPWD/packages/cli/dist/index.mjs" resolve)   # missing .agnox.json
```

An unhandled stack trace instead of a message means an error escaped `AgnoxError` handling in
`packages/cli/src/commands/resolve.ts`.

## 4. If the config schema changed

`packages/core/schema/agnox.schema.json` is generated from the Zod model, and the generator reads
the **built** output:

```sh
pnpm --filter @agnox/core run build
pnpm --filter @agnox/core run schema
```

`packages/core/test/json-schema.test.ts` fails when the committed file drifts, so a failing test
there means you skipped this step — not that the test is wrong.

## 5. If a built-in skill or the assets path changed

The `SKILL.md` files are package assets, not compiled output, so a passing test suite does not prove
they survive publishing:

```sh
pnpm --filter @agnox/core exec pnpm pack --pack-destination /tmp
tar -tzf /tmp/agnox-core-*.tgz | grep skills
```

Every built-in skill must appear under `package/skills/`. If it does not, `files` in
`packages/core/package.json` or the relative path in `packages/core/src/assets.ts` is wrong.

## 6. If a published package changed

```sh
pnpm changeset
```

Docs-only and CI-only changes do not need one.

## Reporting

State the real result: the number of tests that passed, and any command that failed with its
output. Do not report success on a pipeline you did not run to completion.
