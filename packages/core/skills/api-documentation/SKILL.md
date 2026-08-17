---
name: api-documentation
description: Document interfaces so a caller can use them without reading the source.
---

# API documentation

The test of interface documentation is whether someone can call it correctly on the first attempt
without opening the implementation.

## Document the contract

State what the operation does, what it requires, what it guarantees, and what it does not promise.
Behavior a caller can rely on must be written down; everything else stays free to change.

## Cover errors as first-class

List the failure modes, how they are signalled, and what the caller should do about each. Error
behavior is the least documented and most needed part of any interface.

## Explain the why, not the what

Restating the signature in prose adds nothing. Explain constraints, units, ownership, lifetimes and
side effects — the things the type cannot express.

## Generate from the source of truth

Derive reference documentation from the schema, types or annotations that define the interface.
Hand-maintained copies drift, and a drifted reference misleads with authority.

## Version and describe changes

Say when behavior changed and what callers must do. Migration notes matter more than a changelog
entry, because they tell the reader what action to take.
