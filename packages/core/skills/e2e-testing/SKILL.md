---
name: e2e-testing
description: Write end-to-end tests that are few, critical and stable.
---

# End-to-end testing

End-to-end tests are the most expensive and most fragile tests in a suite. Spend them on the
journeys that lose money or trust when they break.

## Select ruthlessly

Cover sign-up, authentication, payment and the core workflow of the product. Do not re-test
validation rules or edge cases that unit tests already cover.

## Wait for state, never for time

Wait for the condition that proves readiness: an element, a response, a state change. Fixed sleeps
are the primary source of both flakiness and slow suites.

## Select elements by intent

Target roles, labels and dedicated test identifiers. Selectors built on CSS structure or generated
class names break on every refactor without any behavior changing.

## Isolate the run

Create the data each test needs and remove it afterwards. Tests that depend on a shared seeded
environment fail unpredictably as that environment drifts.

## Make failures diagnosable

Capture screenshots, traces and logs on failure. An end-to-end failure without artifacts costs more
to reproduce than to fix.
