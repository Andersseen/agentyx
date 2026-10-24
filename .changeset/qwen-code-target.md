---
"@agentyx/adapters": minor
"@agentyx/cli": minor
"@agentyx/core": minor
---

Add Qwen Code as an install target: Skills to `.qwen/skills`, project agents to `.qwen/agents`, and both MCP servers and hooks into `.qwen/settings.json`.

Qwen Code reads MCP servers and hooks from one document, so Agentyx now plans such a file as a single merge instead of two independent ones, which would each be planned from a stale read and let the second write drop the first. The lock records it as one `settings` entry naming both the servers and the hooks; existing `mcp` and `hook` entries for other providers are unchanged, and a lock written before this change is still read and pruned correctly.

Qwen Code documents `$VAR`/`${VAR}` expansion for a stdio server's `env`, which Agentyx renders, but documents `headers` as literal values with no reference mechanism. An HTTP server needing a header from the environment therefore fails with `unsupported_mcp_env_reference` rather than writing `${VAR}`, which the provider would send as the credential itself. Its `http` transport renders as `httpUrl`, never as `url` — that key is Qwen Code's legacy SSE transport.

Doctor reports Qwen Code session lifecycle, tool use and MCP use, but not Skill use: the provider documents no `Skill` tool, so a model-selected Skill leaves no hook payload, and counting only explicitly typed `/skill` invocations would report every other use as "no observed use". Qwen Code loads project hooks only for a trusted folder, so its hooks are reported as configured with review possibly required, never as active.
