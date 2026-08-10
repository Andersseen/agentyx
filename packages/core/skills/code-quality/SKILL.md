---
name: code-quality
description: Keep code clear, local, and purposeful while changing existing systems.
---

# Code quality

Write code that is easy to inspect and hard to misuse.

## Local fit

Match naming, structure, and error-handling style already used nearby. A change should look like it
belongs in the module that owns it.

## Purposeful units

Keep functions and modules small enough to understand, but do not split code just to create layers.
Each helper should name a useful idea or remove meaningful repetition.

## Noise

Delete dead code. Avoid speculative options, unused parameters, and exports nobody needs. Comments
should explain why a choice exists, not restate what the code says.

## Errors

Handle errors where useful context exists. Preserve the original cause when it helps debugging, and
return or throw errors with messages a caller can act on.
