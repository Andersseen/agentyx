---
name: rust-testing-portability
description: Write deterministic, portable Rust tests that cover regressions and user-visible behavior. Use when adding or fixing Rust tests, fixing a bug, or touching code that must run on Linux, macOS and Windows.
---

# Rust testing and portability

## Level

- Unit tests (`#[cfg(test)]`) for pure logic and edge cases inside one module.
- Integration tests (`tests/*.rs`) for the public API or the real binary, including exit codes and
  the stdout/stderr text users see.
- Every fixed bug gets a regression test that fails without the fix. Name it for the behavior, not
  the issue number.

## Deterministic

- Use `tempfile` for filesystem fixtures; never write into the source tree or depend on the current
  directory. Build fixtures in code or from small checked-in directories.
- Do not sleep for arbitrary durations. Poll a condition with a bounded timeout, or inject the clock
  or dependency. Bind port `0` instead of assuming a free port.
- Sort anything from directory walks or hash maps before comparing.
- Isolate the environment: set the variables a child process needs and clear those it must not
  inherit.
- To diagnose flakiness, repeat the single test (a shell loop around `cargo test <name>`) before
  claiming it is stable.

## Portable

- Build paths with `join`; compare `/`-normalized strings only where the code promises them. Add a
  Windows-separator case for any path or ID normalization.
- Gate platform behavior with `#[cfg(unix)]` (symlinks, permissions) and `#[cfg(windows)]`. Do not
  assume executable names or `.exe` suffixes; use `env!("CARGO_BIN_EXE_<name>")`.
- Normalize `\r\n` before comparing generated text.
- Do not create two fixtures differing only by case in one directory; case-insensitive filesystems
  will merge them.

## Snapshots

Keep goldens small, reviewed and regenerated only through the project's documented command. Strip
absolute paths, timestamps and versions so they pass on every platform.
