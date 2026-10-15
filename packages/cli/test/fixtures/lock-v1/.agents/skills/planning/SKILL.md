---
name: planning
description: Plan non-trivial work before editing, and keep small changes small.
---

# Planning

Match the plan to the size of the change. A one-line fix does not need one. Work that touches
several files, changes a public contract, or has no obvious shape does.

## Before editing

- Read the code you are about to change, and the code that calls it. Do not edit a file you have
  not opened.
- Name the files the change will touch and what each one does differently afterwards.
- State the assumptions the change rests on, and check the ones that are cheap to check. An
  assumption you cannot verify is an open question, not a fact.

## Decomposing

Split work where a step can be verified on its own. Every step should leave the project working:
tests passing, build succeeding, nothing half-migrated.

Order the steps so the load-bearing part comes first. Finding a design problem after the tests and
the documentation are written wastes both.

## Scope

Solve the problem in front of you. Do not add structure for requirements that have not arrived — an
interface with one implementation, an option nobody sets, or a layer that only forwards calls is a
cost with no payer.

Prefer the change that fits how the code already works over the one that is cleaner in isolation.
Consistency is cheaper to maintain than local elegance.

## When the plan is wrong

A plan is a hypothesis. When the code contradicts it, revise it and say so rather than forcing the
original steps through. Report what changed and why.
