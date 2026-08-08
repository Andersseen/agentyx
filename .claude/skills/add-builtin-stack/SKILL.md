---
name: add-builtin-stack
description: Add a stack to the Agnox built-in registry (packages/core/src/stack/registry.ts) with the registry and resolver tests it needs. Use when asked to add, rename, or re-parent a built-in stack such as core, typescript, angular, or a new one.
---

# Add a built-in stack

Stacks are **data**. Adding one is an entry in an array plus tests — never a new branch in the
resolver.

## 1. Add the definition

In `packages/core/src/stack/registry.ts`, append to `builtInStacks`:

```ts
{
  name: "react",
  description: "React development environment.",
  extends: ["typescript"],
  skills: ["react-modern"],
},
```

Rules for the definition:

- `name` is the only required field, but always write a one-line `description`.
- `extends` lists parents in dependency-first order. Omit it for a root stack; `createStackRegistry`
  applies the `[]` default.
- Array position does not affect resolution — the resolver follows `extends`, so a parent may be
  declared after its child. It does affect `[...builtInStackRegistry.keys()]`, which
  `packages/core/test/stack-registry.test.ts` asserts exactly, so append and update that assertion.
- `skills` also defaults to `[]`. Every name listed must exist in `builtInSkillNames` with a
  matching `packages/core/skills/<name>/SKILL.md`, or resolution throws `UnknownSkillError`. Adding
  a stack does not require adding a skill — reuse the inherited ones when they cover it.
- MCP tools, agents, optimization rules and adapter configuration do **not** exist in
  `stackDefinitionSchema`, and `strictObject` will reject them.
- Never name a stack after a provider. `codex`, `claude` and `kimi` are *targets*, not stacks.

## 2. Update the registry test

In `packages/core/test/stack-registry.test.ts`:

- add the new name to the `[...builtInStackRegistry.keys()]` assertion, in position;
- add its `extends` to the relationships test;
- add its `skills` to the skills test.

## 3. Add a resolution test

In `packages/core/test/stack-resolver.test.ts`, assert the full expected chain:

```ts
it("resolves react through typescript", () => {
  expect(resolveStacks(["react"])).toEqual(["core", "typescript", "react"]);
});
```

If the stack contributes skills, assert the resolved skill list in
`packages/core/test/skill-resolver.test.ts` too — inherited skills first, then its own.

If the new stack shares a parent with an existing one, also assert the de-duplicated multi-root
case — that is where ordering bugs show up.

## 4. Documentation

The stack table in `README.md` lists the built-in stacks. Update it, and keep it to metadata: no
real TypeScript or Angular instructions belong in this repo yet.

## 5. Verify

```sh
pnpm test
pnpm build && node packages/cli/dist/index.mjs resolve <new-stack>
```

The CLI output is the resolved chain, one stack per line, dependency-first.

## Custom registries

`createStackRegistry(definitions)` builds an independent registry, and `resolveStacks(names,
registry)` and `resolveAgnoxConfig(config, registry)` both accept one. Use that in tests for cycles,
diamonds and unknown-parent cases instead of touching the built-in list. External and remote
registries are **not** implemented — do not add loading code for them.
