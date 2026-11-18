---
"@agentyx/core": minor
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Harden ownership and reproduction from real-project pilot findings. `sync` and `install` no longer
replace an Agentyx-owned MCP server or hook entry that was edited by hand, or a same-named entry the
project already configured, without `--force`; an upgraded definition still updates, and Doctor now
reports the edit. Frozen install and `doctor --locked` no longer refuse to restore a Skill after the
project's last MCP server was excluded. Conflict messages say whether a path was edited, never written
by Agentyx, or holds a differing config entry, with the matching recovery. The generated
project-context Skill's description now says when to read it and which commands it holds, so
lazily loading providers open it.
