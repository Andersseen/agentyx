---
name: test-strategy
description: Choose the right test level and scope before writing tests.
---

# Test strategy

Decide what a test is for before writing it. Most wasted test effort comes from testing at the wrong
level, not from writing tests badly.

## Choose the level

Cover business rules and edge cases with unit tests, module boundaries and wiring with integration
tests, and only critical user journeys end to end. Push detail down: if a case can be covered one
level lower, cover it there.

## Test behavior, not structure

Assert on observable behavior through the public interface. A test that breaks when an
implementation detail changes, while behavior stays the same, is a liability.

## Keep tests independent

Each test sets up the state it needs and passes in any order, alone or in parallel. Shared mutable
fixtures produce failures that depend on execution order.

## Name for the case

State the scenario and the expected outcome. A failing test name should identify the broken behavior
without opening the file.

## Cover the boundaries

Prioritize empty input, a single element, maximum size, null and undefined, concurrent access, and
failure of every external dependency.
