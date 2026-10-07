---
name: rust-filesystem-safety
description: Handle untrusted paths, symlinks and output directories safely in Rust. Use only when Rust code reads, walks, scans, generates, scaffolds or writes files whose names or locations come from users or repository contents; skip for code that never touches paths.
---

# Rust filesystem safety

Treat names and locations from users, repositories, manifests and links as untrusted. A file inside
the project can still point outside it.

## Paths

- Use `Path`/`PathBuf` and `components()` for path logic, never string slicing or `split('/')`.
  Convert to `/`-joined strings only for URLs or IDs, handling `\` explicitly.
- Accept a user-supplied relative path only if every component is `Component::Normal`; reject `..`,
  root, drive/UNC prefixes and empty paths. Absolute inputs need an explicit decision.
- Containment: canonicalize root and target, then `Path::starts_with` (component-wise, not a string
  prefix). Do it before reading content, and again for resolved link targets. Canonicalizing needs an
  existing path; for a new file, canonicalize the parent.
- `to_str()` is `Option`: non-UTF-8 names are normal, so handle them without panicking.

## Symlinks and races

- Decide symlink behavior per feature; default to refusing. Walk without following links and inspect
  with `symlink_metadata`. Never write through a symlinked directory. Treat Windows junctions the
  same way.
- Checks and use are separate syscalls, so a check cannot guarantee safety. Prefer an operation that
  fails safely (`create_new`) over check-then-act, and expect files to vanish mid-run.

## Collisions

On case-insensitive filesystems two names differing only by case collide. Detect collisions on a
normalized key before writing. On Windows also watch trailing dots/spaces and reserved device names.

## Writing

- Never overwrite or delete what you did not create. Use `OpenOptions::create_new(true)` for new
  files and report `AlreadyExists`. Delete only paths you recorded or can prove are yours (for
  example via a marker file).
- For generated output directories, write into a staging directory on the same filesystem and rename
  into place, keeping the last good output on failure.

## Bounds and errors

Bound traversal (depth, entry count, file size). Skip an unreadable or non-UTF-8 file with a
diagnostic naming the path instead of failing the whole run, unless the caller needs completeness.
