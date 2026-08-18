---
name: branching-strategy
description: Keep branches short-lived and integrate continuously.
---

# Branching strategy

Merge pain grows superlinearly with divergence. The most effective strategy is the one that keeps
branches short.

## Keep branches short-lived

Aim for hours or days, not weeks. A long-running branch is an accumulating integration debt, and the
work it contains is invisible to everyone else until the end.

## Integrate frequently

Bring changes from the main branch into yours regularly rather than resolving everything at the end.
Frequent small conflicts are trivial; one large conflict is dangerous.

## Decouple deployment from release

Merge incomplete work behind a flag rather than holding it on a branch. Hiding unfinished features at
runtime is safer than hiding them in version control.

## Protect the main branch

Require review and a green build before merging. The main branch must always be in a releasable
state, since that is the assumption everything else depends on.

## Pick one convention and hold it

Whether the team rebases or merges matters far less than doing it consistently. Mixed conventions
produce confusing history and avoidable conflicts.
