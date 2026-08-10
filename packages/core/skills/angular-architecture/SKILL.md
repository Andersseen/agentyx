---
name: angular-architecture
description: Structure Angular features with clear boundaries, DI, OnPush, and accessibility.
---

# Angular architecture

Keep Angular structure feature-oriented and explicit.

## Boundaries

Group components, services, routes, and tests around features. Put state where it is owned: local
component state stays local, shared state belongs in a focused service, and global services should
be rare.

## Components and DI

Use services and dependency injection for reusable behavior and integration boundaries. Prefer
presentational/container separation only when it clarifies ownership or testing.

## Rendering

Design for `OnPush` and zoneless-compatible updates: signals, async pipe, explicit events, and clear
change notifications. Avoid code that depends on zone patching side effects.

## Accessibility

Preserve semantic HTML, labels, keyboard access, focus management, and ARIA only where semantics
need help.
