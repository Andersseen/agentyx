---
name: dependency-hygiene
description: Keep the dependency graph small, current and pointing one way.
---

# Dependency hygiene

Every dependency is a commitment: to its API, its release cadence and its own dependencies.

## Justify each addition

Prefer the standard library and existing project dependencies. Adding a package for a function you
could write in a few lines trades a small cost now for an upgrade obligation forever.

## Keep direction one way

Module dependencies should form a directed acyclic graph. A cycle means the two modules are really
one, and it blocks testing, reuse and independent change.

## Depend on abstractions at boundaries

Isolate third-party clients behind an interface you own so a replacement touches one place. Apply
this where the risk is real, not to every import — an indirection layer for its own sake is cost
without benefit.

## Remove what is unused

Unused dependencies still carry vulnerabilities, install time and upgrade noise. Prune them
deliberately, since no tool will decide for you that a package is no longer wanted.

## Watch the transitive graph

Direct dependency count understates the real surface. Review what a package brings with it before
adding it, and prefer libraries with a small, well-maintained tree.
