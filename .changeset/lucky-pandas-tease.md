---
"@agentyx/adapters": minor
"@agentyx/core": minor
"@agentyx/cli": minor
---

Track installed files in `.agentyx.lock.json` so installation is reversible and safe to run in a
shared skills directory. Agentyx now refuses to overwrite a destination it has no record of writing
(`--force` overrides), `install --prune` removes managed files and MCP entries the current selection
no longer resolves, `agentyx uninstall` removes everything the manifest records, and `doctor` reports
stale, edited and unmanaged files.
