---
name: context-efficient-development
description: Develop with targeted discovery, narrow iteration, and complete verification.
---

# Context-efficient development

Save context by doing the right work in the right order.

## Discovery

Start with targeted search, then read the relevant symbol or range, then the containing module when
ownership is unclear. Open whole files when needed, not by reflex. Avoid rereading code whose role
is already understood.

## Iteration

Run the smallest useful command while shaping a change: one test file, one package check, one build
step. Expand only when the touched surface grows.

## Completion

Before calling work complete, run the project’s required full verification for the affected surface.
Efficiency reduces waste; it does not reduce correctness.
