---
name: decision-records
description: Record significant technical decisions with their context and consequences.
---

# Decision records

Code shows what was built. A decision record preserves why, which is the part that is otherwise lost
when people move on.

## Record decisions that are costly to reverse

Write one for choices that shape structure: a datastore, a protocol, a boundary, a framework, a
significant dependency. Routine or easily reversed choices do not need one.

## Capture the context

State the forces at the time — constraints, deadlines, team size, what was known and what was not. A
decision that looks wrong later is usually a decision whose context was forgotten.

## Name the alternatives and why they lost

The options rejected carry most of the value. Without them, a future reader re-opens a question that
was already settled for good reasons.

## State the consequences honestly

Record what the choice makes harder as well as what it makes easier. Acknowledged tradeoffs are what
let someone recognize later that the tradeoff has stopped being worth it.

## Supersede, never rewrite

When a decision changes, write a new record that replaces the old one and leave the original intact.
The history of decisions is itself information.
