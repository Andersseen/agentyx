---
name: flaky-tests
description: Diagnose and fix non-deterministic tests instead of retrying them.
---

# Flaky tests

A test that passes and fails without a code change destroys trust in the whole suite. Treat it as a
defect, not as noise.

## Never paper over it

Do not add a retry, a longer timeout or a skip as the fix. Retries hide real race conditions that
will surface in production, and a skipped test is a deleted test that still costs time to run.

## Find the source of non-determinism

The usual causes are time, ordering, concurrency, shared state, network and randomness. Pin clocks,
seed randomness, isolate state, and await every asynchronous operation explicitly.

## Reproduce before fixing

Run the test repeatedly, in random order and in parallel until the failure is reliable. A fix applied
to a failure you cannot reproduce is a guess.

## Quarantine with a deadline

If a flaky test must leave the critical path immediately, record why and when it will be fixed. An
unbounded quarantine list becomes permanent, and the coverage it represented is silently gone.
