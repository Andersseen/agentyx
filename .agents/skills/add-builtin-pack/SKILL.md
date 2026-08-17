---
name: add-builtin-pack
description: Add a pack to the Agentyx built-in registry (packages/core/src/pack/registry.ts) with the registry and resolver tests it needs. Use when asked to add, rename or re-categorize a built-in pack such as technical, typescript, angular, efficiency or agentic.
---

# Add a built-in pack

Packs are **data**. Adding one is an entry in an array plus tests — never a new branch in the
resolver.

## Packs do not inherit

There is no `extends` field and no inheritance chain. `resolvePacks` returns exactly the packs that
were requested, in configured order, de-duplicated by first occurrence. Composition is the user's
job: a project that wants TypeScript *and* Angular behaviour selects both in `.agentyx.json`.

`packDefinitionSchema` is a `strictObject`, so an `extends` key does not silently do nothing — it
throws. `CircularPackDependencyError` still exists in `packages/core/src/pack/errors.ts` but is
deprecated and unreachable; do not write code or tests against it.

## 1. Add the definition

In `packages/core/src/pack/registry.ts`, append to `builtInPacks`:

```ts
{
  name: "react",
  category: "framework",
  description: "Modern React development environment.",
  skills: ["react-modern"],
},
```

Rules for the definition:

- `name` is the only required field, but always write a one-line `description`.
- `category` is one of `engineering`, `language`, `framework`, `efficiency`, `workflow`. It is
  discoverability metadata only and does **not** affect resolution. It defaults to `engineering`,
  so set it explicitly whenever that default is wrong.
- `skills`, `mcpServers` and `tools` all default to `[]`.
- Array position does not affect resolution. It does affect `[...builtInPackRegistry.keys()]`, which
  `packages/core/test/pack-registry.test.ts` asserts exactly, so append and update that assertion.
- Every name in `skills` must exist in `builtInSkillNames`
  (`packages/core/src/skill/built-in.ts`) with a matching `packages/core/skills/<name>/SKILL.md`, or
  resolution throws `UnknownSkillError`. Adding a pack does not require adding a skill — reuse the
  existing ones when they cover it.
- `mcpServers` and `tools` accept either a bare name or `{ name, activation }`, where `activation`
  is `"default"` or `"optional"`. A bare name normalizes to `activation: "default"`. Use
  `{ name, activation: "optional" }` for anything heavy enough that a user should opt in via
  `enable`. Referenced names must exist in `builtInMcpServerRegistry` / `builtInToolRegistry` or
  resolution throws.
- Adapter configuration, provider-specific rules and `targets` do **not** exist in
  `packDefinitionSchema`, and `strictObject` will reject them.
- Never name a pack after a provider. `codex`, `claude` and `kimi` are *targets*, not packs.

## 2. Update the registry test

In `packages/core/test/pack-registry.test.ts`:

- add the new name to the `[...builtInPackRegistry.keys()]` assertion, in position — and rename that
  test if its title still counts the packs ("ships exactly the first five packs");
- add its `skills` to the declared-skills test if the pack is one users will select directly.

The cross-checks that every referenced skill, MCP server and tool exists in the corresponding
built-in registry iterate the whole registry, so they cover a new pack without being edited.

## 3. Add a resolution test

In `packages/core/test/pack-resolver.test.ts`, assert that the pack resolves to itself and composes
without pulling anything in:

```ts
it("resolves react without hidden inheritance", () => {
  expect(resolvePacks(["react"])).toEqual(["react"]);
  expect(resolvePacks(["typescript", "react"])).toEqual(["typescript", "react"]);
});
```

If the pack contributes skills, assert the resolved skill list in
`packages/core/test/skill-resolver.test.ts` too, using `resolvePackSkills`. Skills come out in pack
order, then declaration order within each pack.

## 4. Documentation

The pack table in `README.md`, under `## Packs`, lists the built-in packs with their category and
purpose. Update it, and keep it to metadata: no real TypeScript or React instructions belong in that
table. If the pack declares an optional MCP server or tool, add it to the `## Optional Capabilities`
list as well.

## 5. Verify

```sh
pnpm test
pnpm build && node packages/cli/dist/index.mjs resolve <new-pack>
```

`resolve` prints `Packs`, `Skills`, `MCP` and `Tools` sections, identifiers only. Optional
capabilities appear as `disabled (optional)` until enabled, which you can check with:

```sh
node packages/cli/dist/index.mjs resolve <new-pack> --enable <capability>
node packages/cli/dist/index.mjs pack show <new-pack>
```

## Custom registries

`createPackRegistry(definitions)` builds an independent registry, and `resolvePacks(names, registry)`
and `resolveAgentyxConfig(config, registry)` both accept one. Use that in tests for duplicate-name
and unknown-pack cases instead of touching the built-in list. External and remote registries are
**not** implemented — do not add loading code for them.
