---
name: verify-agentyx
description: Run the full Agentyx verification pipeline before handing work back - formatting, typecheck, tests, build, and the CLI behaviour checks that pnpm check does not cover. Use after any change to packages/core, packages/cli, or the config schema.
---

# Verify an Agentyx change

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
node packages/cli/dist/index.mjs resolve technical
node packages/cli/dist/index.mjs resolve typescript testing security
node packages/cli/dist/index.mjs resolve angular --json

node packages/cli/dist/index.mjs pack list
node packages/cli/dist/index.mjs pack show efficiency
node packages/cli/dist/index.mjs skill list
node packages/cli/dist/index.mjs skill show planning
node packages/cli/dist/index.mjs mcp list
node packages/cli/dist/index.mjs mcp show context7

(cd examples/angular && node ../../packages/cli/dist/index.mjs resolve)
(cd examples/angular && node ../../packages/cli/dist/index.mjs resolve --json)
```

`resolve` prints `Packs`, `Skills`, `MCP` and `Tools` sections, identifiers only — never skill
contents. Packs come out in the order requested, with no inheritance: `resolve typescript testing
security` lists exactly those three. Human output for the example project is the
`Agentyx configuration` block, which adds a `Targets` section first. `--json` must print JSON and
nothing else.

Optional capabilities render as `disabled (optional)` until enabled, so this pair must differ:

```sh
node packages/cli/dist/index.mjs resolve efficiency
node packages/cli/dist/index.mjs resolve efficiency --enable rtk
```

## 3. Error paths

Each of these must print a readable message on **stderr** and exit with code 1:

```sh
node packages/cli/dist/index.mjs resolve svelte        # unknown pack
node packages/cli/dist/index.mjs pack show nope        # unknown pack
node packages/cli/dist/index.mjs skill show nope       # unknown skill
node packages/cli/dist/index.mjs mcp show nope         # unknown MCP server
(cd /tmp && node "$OLDPWD/packages/cli/dist/index.mjs" resolve)   # missing .agentyx.json
```

Note that `$(...)` swallows the exit code, and that zsh does not word-split an unquoted variable, so
check each command directly rather than through a loop that builds the arguments as one string.

An unhandled stack trace instead of a message means an error escaped `AgentyxError` handling.
`emit` in `packages/cli/src/output.ts` rethrows anything that is not an `AgentyxError` on purpose, so
the fix belongs in the command: throw the domain error from `packages/core/src/*/errors.ts` rather
than a plain `Error`.

## 4. Installation, if adapters or planning changed

Planning and writing are separate, and only an install writes. Verify against a scratch project
rather than this repository:

```sh
tmp=$(mktemp -d)
printf '{"packs":["testing"],"targets":["claude"]}' > "$tmp/.agentyx.json"
(cd "$tmp" && node "$OLDPWD/packages/cli/dist/index.mjs" install)
```

Every listed skill must exist under `.claude/skills/<name>/SKILL.md` with its frontmatter intact,
`.mcp.json` must contain only enabled servers and never a credential, and `.agentyx.lock.json` must
record what was written.

## 5. If the config schema changed

`packages/core/schema/agentyx.schema.json` is generated from the Zod model, and the generator reads
the **built** output:

```sh
pnpm --filter @agentyx/core run build
pnpm --filter @agentyx/core run schema
```

`packages/core/test/json-schema.test.ts` fails when the committed file drifts, so a failing test
there means you skipped this step — not that the test is wrong.

Adding a pack, a skill or an MCP server does **not** change the schema. Those are data, and the
schema only describes the shape of `.agentyx.json`.

## 6. If a built-in skill or the assets path changed

The `SKILL.md` files are package assets, not compiled output, so a passing test suite does not prove
they survive publishing:

```sh
pnpm --filter @agentyx/core exec pnpm pack --pack-destination /tmp
tar -tzf /tmp/agentyx-core-*.tgz | grep skills
```

Every built-in skill must appear under `package/skills/`. If it does not, `files` in
`packages/core/package.json` or the relative path in `packages/core/src/assets.ts` is wrong.

## 7. If a published package changed

```sh
pnpm changeset
```

Docs-only and CI-only changes do not need one.

## Reporting

State the real result: the number of tests that passed, and any command that failed with its output.
Do not report success on a pipeline you did not run to completion.
