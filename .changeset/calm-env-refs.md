---
"@agentyx/adapters": patch
"@agentyx/cli": patch
---

Fix MCP environment references for Codex and Kimi Code, which previously received the variable *name* as a literal value. Codex now forwards the variable with `env_vars`; Kimi Code, which documents no reference mechanism, no longer gets a wrong literal. A server transport an adapter does not declare now fails with `unsupported_mcp_transport` instead of being rendered, and `uninstall --help` now mentions agents. Codex documentation links point at the current official pages.
