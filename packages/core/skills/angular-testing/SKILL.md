---
name: angular-testing
description: Test Angular behavior with appropriate unit, component, and E2E boundaries.
---

# Angular testing

Test behavior users and callers rely on.

## Scope

Use plain unit tests for pure functions and services. Use component tests for rendered behavior,
inputs, outputs, and template interaction. Use E2E tests for routing, browser integration, and
critical user flows.

## Coupling

Avoid tests that depend on private fields, incidental component internals, or exact template
structure unless that structure is the behavior. Prefer user-visible queries and meaningful state.

## Modern APIs

Use current Angular testing helpers and migrations for standalone components, router tests, and
signals. Keep setup small so failures point at behavior, not ceremony.
