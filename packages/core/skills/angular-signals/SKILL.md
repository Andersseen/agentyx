---
name: angular-signals
description: Use Angular signals for local synchronous state and derived values.
---

# Angular signals

Use signals when state is synchronous and read by templates or nearby code.

## State

Create writable state with `signal()`. Derive values with `computed()` instead of syncing fields by
hand. Keep `effect()` for side effects such as logging, persistence, or imperative integration.

## Boundaries

Use signal inputs, queries, and model APIs where they fit new Angular code. Bridge RxJS at the edge
with Angular interop helpers when a stream must feed signal state.

## RxJS

Do not replace every observable with a signal. RxJS remains appropriate for async streams, event
composition, cancellation, retries, and multicasting.
