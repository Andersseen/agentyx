---
name: test-doubles
description: Use fakes, stubs and mocks deliberately instead of mocking everything.
---

# Test doubles

Replace a real dependency only when using it makes the test slow, non-deterministic, or impossible
to run.

## Prefer the real thing

Use the real implementation when it is fast and deterministic. In-memory databases, temporary
directories and local fakes usually beat a mock, because they exercise the actual contract.

## Match the double to the need

Use a stub to supply input, a fake for a working lightweight implementation, and a mock only when
the interaction itself is the behavior under test. Asserting on calls to a dependency that is not
the subject couples the test to implementation.

## Double boundaries you own

Replace your own abstraction over a third-party client rather than the client internals. When the
library changes shape, one adapter moves instead of every test.

## Keep doubles honest

A double that accepts calls the real dependency would reject turns a passing test into false
confidence. Verify the contract against the real implementation at least once.
