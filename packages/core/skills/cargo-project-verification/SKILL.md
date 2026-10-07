---
name: cargo-project-verification
description: Verify Rust work in a single crate or Cargo workspace before handoff, and keep manifests, lockfile, features and public API consistent. Use before declaring Rust work done and when editing Cargo.toml, Cargo.lock, features or public items.
---

# Cargo project verification

Complements the generic `verification` Skill: that covers the discipline of proving a change; this
covers Cargo specifics.

## Find the real gate

Read the repository's CI workflows, Makefile/justfile and contributor docs first. Repository policy
wins over any default below, including flags, feature sets and toolchain.

Typical baseline (drop `--workspace` for a single crate, adjust features to what the repo supports):

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --locked
cargo build --workspace --locked
```

- `--locked` assumes `Cargo.lock` is committed. Libraries sometimes ignore it; do not invent or
  commit one against repository convention. If a lockfile is tracked and changed, say why.
- `--all-features` is not valid everywhere (mutually exclusive or platform-specific features). Use
  the combinations CI uses.
- Fix clippy findings rather than adding `#[allow]`; if an allow is justified, scope it to the item
  with a reason.

## Manifests

- In a workspace, shared versions and metadata belong in `[workspace.package]` and
  `[workspace.dependencies]`; members inherit with `.workspace = true`. Do not re-pin them.
- Add a dependency only with a reason; check `default-features` and the features it enables.
- `rust-version` is a contract: avoid newer APIs and do not raise it casually.
- Features should be additive. After adding or changing one, build with `--no-default-features`
  and the repository's full feature set.

## Public API and release

- Public changes (items, CLI flags, output formats, schemas) need tests and docs. Run
  `cargo doc --no-deps` when docs link to changed items, and call the change out in the summary.
- For publishable crates, `cargo package --list` or `cargo publish --dry-run` shows what ships. Never
  edit release versions by hand if release tooling owns them.

Report the exact commands run and their outcome; name any you could not run and why.
