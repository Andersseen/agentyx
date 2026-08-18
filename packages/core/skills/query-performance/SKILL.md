---
name: query-performance
description: Diagnose slow database access with query plans, indexes and access patterns.
---

# Query performance

Most application slowness is data access. Read the query plan before changing the query.

## Read the plan

The execution plan shows what the database actually does: scans, joins, sorts and row estimates. A
large gap between estimated and actual rows usually means stale statistics or an unsuitable index.

## Index for the access pattern

Index the columns used to filter, join and order, and put the most selective column first in a
composite index. Every index costs write throughput and storage, so add them for measured queries
rather than speculatively.

## Eliminate N+1 access

Loading a collection and then querying once per element is the most common performance defect in
application code. Fetch related data in a single query or a batched load.

## Fetch only what you need

Select the required columns and paginate large result sets with a stable key. Requesting entire rows
and filtering in application code moves the work to the slowest place.

## Watch the pool and the transaction

Long transactions hold locks and connections, turning a slow query into a system-wide stall. Keep
transactions short and do external calls outside them.
