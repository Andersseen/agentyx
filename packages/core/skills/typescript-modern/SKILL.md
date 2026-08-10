---
name: typescript-modern
description: Use current TypeScript module, syntax, import, and async patterns.
---

# Modern TypeScript

Use current platform and language features without making code clever.

## Modules

Prefer ESM. Use type-only imports and exports when a symbol is erased at runtime. Keep module
boundaries explicit and avoid circular dependencies.

## Syntax

Use modern syntax when it clarifies intent: optional chaining, nullish coalescing, object
destructuring, `const`, `for...of`, and `async`/`await`. Avoid transpiler-era patterns when the
runtime supports the native feature.

## Platform

Prefer native platform APIs where they are stable and already available in the project runtime. Do
not add a dependency for behavior the platform provides clearly.

## Async

Use `async`/`await` for sequential asynchronous flow and `Promise.all` for independent work. Handle
rejections at boundaries with useful context.
