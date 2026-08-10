---
name: angular-modern
description: Use current Angular APIs for standalone components, control flow, inputs, outputs, and DI.
---

# Modern Angular

Write new Angular code with current APIs. Reach for legacy patterns only when maintaining existing
code that still depends on them.

## Components

Use standalone components, directives, and pipes. Declare template dependencies in `imports` and do
not introduce an `NgModule` for new feature code.

## Inputs and outputs

Use `input()`, `input.required()`, `output()`, and `model()` where they fit. Keep inputs explicit
and outputs event-like.

## Injection

Use `inject()` in field initializers or framework-supported injection contexts. This keeps
constructors small and makes dependencies visible near their use.

## Templates

Use built-in control flow: `@if`, `@for`, `@switch`, and `@defer`. Give `@for` a stable `track`
expression. Prefer current migration paths when modernizing existing templates.
