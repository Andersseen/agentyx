---
name: refactoring-safely
description: Change structure without changing behavior, in reversible steps.
---

# Refactoring safely

Refactoring changes structure while behavior stays identical. The moment behavior changes it is no
longer refactoring, and it needs its own review and its own tests.

## Secure the behavior first

Ensure tests cover the current behavior before restructuring. Without that net, a refactor is an
untested rewrite and any difference goes unnoticed.

## Separate the commits

Never mix refactoring with a feature or a fix in one commit. Mixed changes make review hard and make
a clean revert impossible when something breaks.

## Move in small steps

Take one transformation at a time and keep the suite green between steps. A long sequence of
unverified edits is where the untraceable regression enters.

## Follow the pain

Refactor where change is actually difficult and where work is actually happening. Restructuring
stable code nobody touches spends risk with no return.

## Know when to stop

Stop when the code is clear enough for the change you came to make. Refactoring is preparation for
work, not the work itself.
