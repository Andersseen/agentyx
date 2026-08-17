---
name: legacy-code
description: Work safely in unfamiliar code with weak or missing tests.
---

# Working with legacy code

Legacy code is code you are afraid to change. The goal of each visit is to leave it slightly less
frightening than you found it.

## Characterize before changing

When behavior is undocumented and untested, write tests that capture what the code does today, even
where that looks wrong. Those tests describe reality, and reality is what callers depend on.

## Find a seam

Introduce a boundary where a dependency can be substituted, so a piece becomes testable without
rewriting the whole. A narrow seam beats a broad refactor performed blind.

## Assume the strangeness has a reason

Odd conditionals and special cases usually encode a real requirement or an old incident. Find out why
before deleting; unexplained code is not the same as unnecessary code.

## Improve what you touch

Leave the area you worked in better: a name clarified, a test added, dead code removed. Repository-
wide cleanup campaigns stall, while incremental improvement compounds.

## Do not rewrite by default

A rewrite discards embedded knowledge and restarts the bug-discovery process from zero. Prefer
strangling the old implementation behind a stable interface, one piece at a time.
