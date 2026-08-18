---
name: data-modeling
description: Design schemas that make invalid states unrepresentable.
---

# Data modeling

The schema outlives the application code written against it. Design it so wrong data cannot be
stored in the first place.

## Constrain in the database

Enforce required fields, uniqueness, foreign keys and value ranges at the storage layer. Application
checks are bypassed by migrations, admin tools, background jobs and the next service.

## Model the real relationships

Choose cardinality from the domain rather than from current convenience. Discovering that a
one-to-one is really one-to-many after data exists is among the most expensive corrections available.

## Normalize first, denormalize on evidence

Start from a normalized model and denormalize only for a measured read pattern, accepting the
duplication cost knowingly. Premature denormalization creates inconsistency that is hard to detect.

## Choose types precisely

Use exact numeric types for money, timezone-aware timestamps for instants, and native types for
enumerations. Storing everything as text moves validation to every consumer, forever.

## Plan for deletion

Decide early whether records are removed or marked inactive, and how that interacts with foreign
keys, uniqueness and retention obligations. Retrofitting soft deletion touches every query.
