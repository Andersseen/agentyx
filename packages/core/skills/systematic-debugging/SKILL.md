---
name: systematic-debugging
description: Find the root cause from evidence instead of guessing at fixes.
---

# Systematic debugging

A bug is the gap between what the code does and what you believe it does. Close it with evidence,
not with edits.

## Reproduce first

Get a reliable reproduction before changing anything: a failing test, a command, an input. Without
one you cannot know that you fixed it. An intermittent failure still counts — record how often it
happens and under what conditions.

## Gather evidence

Read the real error, the whole stack trace, and the code at the top frame. Then narrow it down:
which input, which branch, which layer. Adding a log line, bisecting the input, or reverting a
recent change all beat reasoning about code you have not read.

Keep what you observed separate from what you inferred.

## Find the root cause

Keep asking why until the answer is a mechanism rather than a symptom. "The value is undefined" is
a symptom; "the loader returns before the cache is populated" is a mechanism. Stop when your
explanation accounts for every detail you saw, including the ones that looked irrelevant. A detail
that does not fit means the explanation is wrong.

## Fix

Change the smallest thing that addresses the cause you identified. Do not fold refactors,
renames, or unrelated cleanups into a bug fix — they hide the fix in the diff.

Never apply a change you cannot justify. Editing until the symptom disappears leaves the bug in
place and usually adds another.

## Verify

Confirm the reproduction passes now, and that it failed before for the reason you claimed. Run the
surrounding tests to catch regressions, and add a test that fails without the fix.
