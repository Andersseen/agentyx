---
name: secrets-handling
description: Keep credentials out of source, logs and client bundles.
---

# Secrets handling

A secret in version control is compromised the moment it is pushed, and rewriting history does not
undo it.

## Keep secrets out of the repository

Load credentials from environment variables or a secret manager. Commit a documented example file
with placeholder values, never the real ones.

## Rotate on exposure

Treat any secret that reached a repository, log, ticket or chat message as leaked. Rotate it before
removing it — deletion without rotation leaves the credential valid.

## Never log or serialize them

Redact credentials, tokens and keys in logs, error messages and crash reports. Review debug output
and third-party error reporters, which capture more surrounding context than expected.

## Understand the client boundary

Anything shipped to a browser or mobile app is public, regardless of build-time substitution. Only
publishable identifiers belong in client code; every real secret stays server side.

## Scan continuously

Run secret scanning in pre-commit hooks and in CI. Detection after the fact is far cheaper than an
incident, and cheaper still before the push.
