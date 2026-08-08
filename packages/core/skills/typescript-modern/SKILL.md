---
name: typescript-modern
description: Modern TypeScript conventions - strict types, inference, small explicit APIs.
---

# Modern TypeScript

Write types that describe the domain, and let the compiler do the rest.

## Typing

Keep `strict` on and treat `any` as a defect. When a value really is unknown, type it `unknown` and
narrow it — with `typeof`, `instanceof`, a discriminant check, or a validator that returns a typed
result.

Annotate what forms a contract: exported functions, public fields, and the boundaries where outside
data enters. Let inference handle everything else; restating an obvious type is noise that drifts
out of date.

Avoid assertions. `as` and `!` silence the compiler without changing the value, so each one is an
unchecked claim. Prove it with a real check instead.

## Modelling

Use discriminated unions for values that come in variants: a `kind` field plus the data that
variant carries beats one wide object of optional properties, and it lets the compiler prove a
`switch` is exhaustive.

Make illegal states unrepresentable where it is cheap — required fields instead of optional ones, a
union instead of two booleans, `readonly` on data that is not meant to change.

Derive types instead of duplicating them. When a schema or a constant already describes a shape,
infer from it; two declarations of the same thing will disagree eventually.

## Modules and APIs

Use ESM. Export the smallest surface callers need and keep helpers module-private — every export is
a contract you have to keep.

Prefer plain functions and plain objects. Classes earn their place when there is real state or
identity; factories, containers, and single-implementation interfaces usually do not.
