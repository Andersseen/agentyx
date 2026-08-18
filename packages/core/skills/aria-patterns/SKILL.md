---
name: aria-patterns
description: Apply ARIA only where native semantics fall short, and keep state accurate.
---

# ARIA patterns

ARIA changes how assistive technology reports an element. It adds no behavior, so incorrect ARIA is
worse than none.

## Prefer native semantics

Reach for ARIA only when no native element expresses the pattern. The first rule of ARIA is not to
use ARIA when markup can do the job.

## Keep state synchronized

Expanded, selected, checked, pressed and disabled states must update whenever the visual state
changes. Stale ARIA state describes an interface the user is no longer looking at.

## Implement the whole pattern

A composite widget such as a menu, tab set, combobox or dialog has an expected set of roles,
relationships and keyboard interactions. Adopting the role without the behavior leaves the control
unusable.

## Manage focus in overlays

Move focus into a dialog when it opens, keep it inside while it is open, and return it to the
trigger on close. Content behind a modal must be inert to assistive technology as well as to
pointers.

## Announce changes sparingly

Use live regions for updates the user must know about, such as errors and completions. Announcing
everything makes the page unusable with a screen reader.
