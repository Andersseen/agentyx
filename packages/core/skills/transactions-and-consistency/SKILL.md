---
name: transactions-and-consistency
description: Choose transaction boundaries and handle concurrent writes correctly.
---

# Transactions and consistency

Concurrency defects are rare in testing and constant in production. Decide the boundary and the
isolation deliberately.

## Scope transactions tightly

A transaction should cover exactly the writes that must succeed or fail together. Long transactions
hold locks and connections, and turn one slow operation into a system-wide stall.

## Keep external calls outside

Never hold a transaction open across a network request to another service. The remote call cannot be
rolled back, and its latency becomes lock duration.

## Know your isolation level

The default isolation of your database determines which anomalies are possible. Read-modify-write
sequences need explicit locking or a compare-and-set, because reading and then writing is not atomic.

## Make retries safe

Give operations an idempotency key so a retried request cannot apply twice. Clients, queues and
proxies all retry, and at-least-once delivery is the normal case.

## Prefer atomic operations to read-then-write

Let the database compute the new value in one statement instead of reading it into the application
and writing it back. That closes the window where another writer intervenes.
