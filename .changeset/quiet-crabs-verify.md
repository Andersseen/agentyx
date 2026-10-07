---
"@agentyx/core": minor
"@agentyx/cli": minor
---

Add a built-in `rust` language pack with four skills (`rust-idiomatic-development`,
`rust-filesystem-safety`, `rust-testing-portability`, `cargo-project-verification`) and detect Rust
projects from a `Cargo.toml` that declares a package or workspace. `agentyx recommend` now suggests
`rust` (and `technical`, which no longer requires a `package.json`) for such repositories, and
`doctor` no longer warns about a missing `package.json` in a Rust project. The pack contributes
skills only; no MCP server, tool or hook. This is a catalog and discovery addition and does not
complete any named roadmap milestone.
