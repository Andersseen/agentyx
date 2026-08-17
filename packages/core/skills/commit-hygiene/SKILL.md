---
name: commit-hygiene
description: Make each commit a single reviewable change with a useful message.
---

# Commit hygiene

History is read far more often than it is written — during review, bisection and incident analysis.
Optimize for those readers.

## One logical change per commit

A commit should do one thing and leave the build working. Mixing a refactor, a fix and a formatting
pass makes review harder and makes a clean revert impossible.

## Explain why in the message

The diff shows what changed; the message must say why. Summarize the intent in the subject and use
the body for context, tradeoffs and consequences that are not visible in the code.

## Never commit noise

Keep generated files, dependencies, editor settings and secrets out. Anything committed once stays in
history even after deletion.

## Separate mechanical from meaningful

Do formatting, renaming and moving in their own commits. A behavioral change hidden inside a
thousand-line reformat will not be reviewed properly.

## Tidy before sharing

Rewriting local history to produce a coherent sequence is good practice. Rewriting history others
have pulled is not — once pushed to a shared branch, history is fixed.
