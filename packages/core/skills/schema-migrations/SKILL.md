---
name: schema-migrations
description: Evolve a live schema without downtime or data loss.
---

# Schema migrations

A migration runs once against real data that cannot be recreated. Treat it with more care than the
code that prompted it.

## Make migrations additive first

Add columns and tables before anything reads them, and remove old structures only after nothing
references them. During deployment both versions of the application run at once.

## Expand, migrate, contract

Add the new shape, backfill it, switch reads and writes over, then drop the old shape in a later
release. Attempting all three at once forces downtime and leaves no safe point to stop.

## Backfill in batches

Update large tables in bounded chunks with pauses between them. A single statement over millions of
rows holds locks and can stall the application entirely.

## Keep them reversible

Provide a tested rollback, or design the change so the previous version still works against the new
schema. A migration you cannot undo turns a small mistake into an incident.

## Test against production-like data

Verify on a realistic copy for both correctness and duration. Migrations that finish instantly in
development regularly run for hours in production.
