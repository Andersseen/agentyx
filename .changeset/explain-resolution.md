---
"@agentyx/core": minor
"@agentyx/cli": minor
---

Add `agentyx resolve --explain` (and `--explain --json`, which wraps the unchanged resolution as `{ resolution, explanation }`). Core gains `explainAgentyxResolution` and a Zod-backed explanation model that attributes every Skill, MCP server, tool, hook and agent to its contributing packs, or to project context for the generated `agentyx-project-context` Skill, and says whether an optional capability is active because it was explicitly enabled. Capability provenance now covers agents, and Doctor's footprint reports active/declared agents without treating them as runtime-observed. When several packs contribute the same MCP server, tool, hook or agent, a default contribution now wins over an optional one, matching the provenance Doctor already used.
