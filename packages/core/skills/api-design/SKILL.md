---
name: api-design
description: Design small explicit APIs with stable contracts and useful errors.
---

# API design

Treat every public function, command flag, file format, and exported type as a contract.

## Surface

Expose the smallest surface that solves the current need. Keep helpers private until a real caller
appears. Avoid making implementation details part of the contract.

## Behavior

Make inputs, outputs, ordering, defaults, and failure modes predictable. If behavior is conditional,
name the condition directly instead of hiding it behind a vague option.

## Compatibility

When changing an existing contract, look for callers, tests, generated artifacts, and docs. Decide
whether compatibility matters for the version you are working on, then migrate the whole surface
consistently.

## Errors

Errors are part of the API. Give expected failures stable types or codes, clear messages, and enough
context for the caller to recover.
