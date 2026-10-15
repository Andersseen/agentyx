---
name: focused-verification
description: Choose narrow checks while iterating and full required gates before completion.
---

# Focused verification

Match checks to risk and phase.

## During iteration

Run the smallest check that can fail for the code you just changed. Prefer a focused test, typecheck
for one package, or a direct command that exercises the behavior.

## Before completion

Run the repository or product gate required for the touched surface. Include manual checks for CLI
output, generated files, migrations, or UI behavior that automated tests do not cover.

## Reporting

Report the exact checks you ran. If a check fails or cannot be run, say that plainly with the reason.
