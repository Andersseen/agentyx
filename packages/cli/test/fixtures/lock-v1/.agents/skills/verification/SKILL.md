---
name: verification
description: Back completion claims with evidence, and report failures plainly.
---

# Verification

"Done" is a claim about observed behaviour. Make it only once you have observed the behaviour.

## Run something

Before reporting work as complete, run what the project already provides: its tests, its type check,
its linter, its build. Use the narrow check while iterating and the full gate before handing work
back.

Some changes are not covered by an automated check — command-line output, a migration, a
configuration change. Exercise those by hand, and say how you did it.

## Separate fact from assumption

Report what you ran and what it printed. Mark anything you did not verify as unverified. "Tests
pass" means you ran them and read the result; it does not mean the change looks right.

Compiling is not passing. Passing is not correct. A test that never ran proves nothing.

## Report failures

State failures plainly, with the command and its real output. Do not present a partial result as a
success, and do not bury a broken step under the steps that worked.

If something fails for a reason unrelated to your change, say so explicitly instead of ignoring it.
If you could not run a check, say which one and why.

## Keep it proportional

Verification should match the risk. A typo in a comment does not need the full suite; a change to
resolution logic, a schema, or a public API does. Skipping a check is a decision to state, not a
detail to leave out.
