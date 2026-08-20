---
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Make the first run reach installed skills on its own. `init` now detects the agents already used in
the project and offers them as targets instead of a fixed pair, explains every pack, capability and
MCP server with its own description, and finishes by installing — interactively by asking, or with
the new `--install` flag. `install --select` replaces its scrollable lists with searchable ones and
an optional pack filter, so choosing among the built-in skills no longer means scrolling through all
of them. Adapters gain `detectConfiguredTargets` and report `configured` alongside `present`.
