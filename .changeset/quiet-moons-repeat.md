---
"@agentyx/cli": patch
---

Fix `agentyx pack show <unknown>` crashing with a Node stack trace instead of reporting the failure.
The command threw a plain `Error`, and `emit` rethrows anything that is not an `AgentyxError` by
design, so the process died before the message was printed. It now raises `UnknownPackError`, which
lists the known packs, matching how `resolve`, `skill show` and `mcp show` already behaved.

`pack show` also read `builtInPacks`, the unvalidated definition input, rather than
`builtInPackRegistry`. It now reads the registry, so the output reflects the schema defaults and
normalized capability references that resolution actually uses.
