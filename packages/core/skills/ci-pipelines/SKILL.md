---
name: ci-pipelines
description: Build pipelines that are fast, reproducible and trusted.
---

# Continuous integration

A pipeline people wait on gets bypassed, and a pipeline people distrust gets ignored. Both failures
end with broken code in the main branch.

## Fail fast and in order

Run the cheapest checks first: formatting, linting, types, unit tests, then slower integration and
end-to-end stages. Developers should learn about a trivial mistake in seconds.

## Make builds reproducible

Pin tool versions and use the committed lockfile. A pipeline that passes or fails depending on when
it ran cannot be used as evidence of anything.

## Keep it fast

Cache dependencies and parallelize independent work. Once feedback takes longer than a short break,
people stop waiting for it and start merging on hope.

## Never tolerate a red main branch

A failing build on the main branch is the highest priority work for the team. Normalizing red builds
removes the entire value of the pipeline.

## Gate on what matters

Enforce the checks that protect correctness and security, and keep advisory checks non-blocking. A
pipeline that blocks on style opinions trains people to skip it.
