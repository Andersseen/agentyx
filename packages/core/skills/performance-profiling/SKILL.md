---
name: performance-profiling
description: Measure before optimizing and confirm the gain after.
---

# Performance profiling

Optimization without measurement is guesswork that costs readability. Find the bottleneck, then fix
the bottleneck.

## Measure first

Profile under conditions that resemble production: realistic data volume, realistic concurrency, a
production build. Development builds and toy datasets hide the actual cost.

## Set a target

Define what fast enough means before starting — a latency budget, a percentile, a throughput figure.
Without a target, optimization has no finish line.

## Fix the dominant cost

Work on the largest contributor first. An improvement to code that accounts for two percent of
runtime cannot matter, however large the factor.

## Prefer algorithmic wins

Removing repeated work, unnecessary round trips and quadratic behavior beats micro-optimization.
Caching is a last resort, not a first move: it adds invalidation as a new class of bug.

## Verify and keep the number

Re-measure after the change and record the result. Track the metric so a regression is caught by the
build rather than by users.
