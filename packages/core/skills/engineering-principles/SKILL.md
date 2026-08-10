---
name: engineering-principles
description: Apply maintainable software-engineering judgment to non-trivial code changes.
---

# Engineering principles

Use these principles as judgment, not ceremony.

## Shape

Prefer simple designs with explicit responsibilities. Keep related decisions close together, and
separate code only when the boundary is real: different reasons to change, different lifetimes, or
different owners.

Favor composition when it keeps behavior visible. Inheritance, frameworks, service containers, and
factories earn their place only when they remove concrete complexity.

## Coupling

Minimize what modules need to know about each other. Pass the smallest data a collaborator needs,
return predictable results, and avoid leaking storage, transport, UI, or provider details through
domain APIs.

## Correctness

Make invalid states difficult to represent. Use schemas, discriminants, required fields, and
exhaustive checks where they clarify the model. Fail explicitly when input is invalid instead of
silently repairing it.

## Maintainability

Optimize for the next person reading the code. A small amount of duplication can be cheaper than an
abstraction that hides the important difference.
