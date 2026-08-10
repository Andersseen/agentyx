---
name: typescript-strict
description: Use TypeScript strictness, narrowing, and validation for safe boundaries.
---

# TypeScript strictness

Keep strict mode valuable by treating escapes as design decisions.

## Unknown data

Use `unknown` for untrusted values, then narrow with control flow, discriminants, predicates, or a
schema validator. Validate external input at the boundary before it enters domain code.

## Avoid unsafe escapes

Avoid `any`, unsafe casts, and non-null assertions. If a value can be absent, model that possibility
and handle it. Prefer checks that prove the value exists over assertions that silence the compiler.

## Optional semantics

When exact optional behavior matters, distinguish an omitted property from a property whose value is
`undefined`. Do not use optional fields as a substitute for a clear variant model.
