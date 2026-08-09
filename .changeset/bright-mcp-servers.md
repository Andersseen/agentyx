---
"@agentyx/adapters": minor
"@agentyx/core": minor
"@agentyx/cli": minor
---

Add provider-agnostic MCP server support. Stacks can now declare `mcpServers`, resolution returns
MCP identifiers, the CLI gains `agentyx mcp list/show`, and install plans merge resolved MCP servers
into project-local Codex and Claude Code configuration without executing MCP processes.
