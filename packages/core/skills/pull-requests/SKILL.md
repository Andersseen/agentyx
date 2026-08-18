---
name: pull-requests
description: Size and present changes so they can actually be reviewed.
---

# Pull requests

Review quality falls sharply with size. A pull request is a request for someone's attention, so make
that attention easy to give.

## Keep them small

Prefer a few hundred changed lines over a thousand. Large pull requests receive approval rather than
review, which is the opposite of the intended effect.

## Do one thing

Cover a single feature, fix or refactor. When a change touches many areas for different reasons,
split it into a sequence that each stand on their own.

## Write the description for the reviewer

State what changes, why, and what to look at closely. Note what you are unsure about — that is where
review is most valuable and where reviewers most often stay silent.

## Make it verifiable

Include the tests that prove the change and say how to exercise it manually where that applies. A
reviewer should not have to reconstruct how you convinced yourself.

## Respond to every comment

Address or explicitly decline each point. Silently ignoring a comment wastes the reviewer's effort
and discourages careful review next time.
