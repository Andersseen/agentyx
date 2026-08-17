---
name: structured-logging
description: Emit machine-readable logs with the context needed to diagnose incidents.
---

# Structured logging

Logs exist to answer questions during an incident. Write them for the person querying at three in
the morning.

## Log structured events, not sentences

Emit key-value fields rather than interpolated prose. Structured records can be filtered, aggregated
and correlated; free text can only be searched by substring.

## Carry correlation identifiers

Propagate a request or trace identifier through every layer, including asynchronous work. Without
it, reconstructing one operation across services is guesswork.

## Use levels with discipline

Error means someone must act, warn means a degraded path was taken, info records significant state
changes, and debug is for development. When everything is an error, the level conveys nothing.

## Never log sensitive data

Credentials, tokens, personal data and payment details must not reach logs, which are widely
readable and long-lived. Redact at the logging boundary rather than trusting call sites.

## Log decisions, not control flow

Record what was decided and why — inputs, chosen branch, outcome. Tracing every function entry
produces volume without insight and buries the events that matter.
