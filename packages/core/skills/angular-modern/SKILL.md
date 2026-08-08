---
name: angular-modern
description: Modern Angular conventions - standalone, signals, inject(), OnPush, zoneless.
---

# Modern Angular

Write new code with the current APIs. Reach for a legacy pattern only when there is no modern
equivalent.

## Components

Components, directives, and pipes are standalone: declare what a template needs in `imports` and do
not add an `NgModule` for new code. Set `changeDetection: ChangeDetectionStrategy.OnPush` on every
component.

Keep components small — template, local state, and the wiring between them. Logic worth testing on
its own belongs in a service or a plain function, not behind a component fixture.

## State

Use signals for component state. Derive with `computed()` rather than recomputing in the template
or syncing fields by hand, and keep `effect()` for genuine side effects — never for writing state
that a `computed()` could express.

Declare inputs with `input()` and `input.required()`, outputs with `output()`, and two-way bindings
with `model()`. Query the view with the signal APIs, `viewChild()` and `contentChild()`.

RxJS still fits streams of events over time; bridge with `toSignal()` and `toObservable()` at the
edges instead of mixing both styles in one component.

## Injection

Call `inject()` in field initialisers instead of taking constructor parameters. It composes inside
plain functions and reads better with `readonly` fields.

## Templates

Use built-in control flow — `@if`, `@for`, `@switch`, `@defer` — not `*ngIf` and `*ngFor`, and give
every `@for` a `track` expression. Read signals directly in the template; the binding tracks them
for you.

## Zoneless

Do not rely on `zone.js` patching. Drive updates through signals, avoid reaching for
`ChangeDetectorRef.detectChanges()` or `NgZone.run()`, and never trigger change detection as a side
effect.
