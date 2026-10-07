---
name: rust-idiomatic-development
description: Write and review idiomatic Rust with clear ownership, expressive types, honest errors and a small public API. Use when adding or changing Rust types, functions, error handling or public items.
---

# Idiomatic Rust

## Ownership

- Borrow before cloning. Accept `&str`, `&Path` and `&[T]`; return owned data only when the caller
  needs it. A `.clone()` added only to satisfy the borrow checker signals a design problem:
  restructure the borrow or scope, or justify the clone in a comment.
- Use `impl AsRef<Path>` or `impl Into<String>` at API edges where callers benefit; keep internals
  concrete.
- Avoid allocation in hot loops: reuse buffers, stream with iterators, use `Cow` when most inputs
  pass through unchanged. Measure before contorting readable code.

## Types

- Make invalid states hard to represent: an `enum` per distinct case instead of a `String` plus
  flags; newtypes whose constructor validates identifiers and similar values.
- Match exhaustively on enums you own. Avoid `_ =>` there so a new variant breaks the build rather
  than silently changing behavior.
- Use an iterator chain when it reads as a pipeline; use a `for` loop for side effects or early
  exits.

## Errors

- Code that handles user input, files or the network returns `Result`. Do not `unwrap`, `expect` or
  index data that originates outside the process; reserve `expect` for true invariants and state the
  invariant in the message.
- Add context where an error crosses a boundary (which path, which key). Diagnostics are user-facing
  output.

## API surface

- Keep `pub` minimal and prefer `pub(crate)`; every public item is a promise.
- Keep serialized/wire types separate from domain types and convert at the boundary. Do not derive
  `Deserialize` on a domain type if that bypasses its constructor validation.
- Document public items with `///`, including failure modes. Comments explain intent, not syntax.

## `unsafe`

`unsafe` is repository policy, not a universal rule. Check `Cargo.toml`, `[workspace.lints]`, existing
`unsafe` blocks and `SAFETY:` comments first. If the repository forbids it, respect that. If it
allows it, keep blocks minimal and document the invariant in a `SAFETY:` comment.
