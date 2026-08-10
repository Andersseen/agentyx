---
name: typescript-modeling
description: Model TypeScript domains with unions, readonly data, satisfies, and useful generics.
---

# TypeScript modeling

Use the type system to express relationships that matter at runtime.

## Shapes

Choose `type` or `interface` for local semantics and ecosystem fit, not dogma. Use discriminated
unions for variants and exhaustive switches where missing cases would be a bug.

## Contracts

Annotate exported APIs and external boundaries. Let inference handle obvious locals. Use `satisfies`
when a value should be checked against a contract without widening away useful literal information.

## Mutability and generics

Mark data `readonly` when mutation is not part of the contract. Use generics only when they express
a real relationship between inputs and outputs; avoid type puzzles that make maintenance harder.
