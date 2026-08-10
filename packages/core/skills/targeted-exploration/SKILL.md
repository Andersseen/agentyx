---
name: targeted-exploration
description: Explore codebases through search, relevant ranges, and module ownership.
---

# Targeted exploration

Explore from signal to context.

## Flow

Search for the name, command, schema, error, or behavior. Read the relevant symbol or range. Then
read nearby callers or tests. Open the whole file when the range does not reveal ownership or
invariants.

## Search

Prefer structural or code-aware search when available. Use text search for identifiers and output
strings. Avoid dumping unrelated files into context.

## Stop condition

Stop exploring when you can name the owning module, the expected behavior, the likely change, and
the checks that will verify it.
