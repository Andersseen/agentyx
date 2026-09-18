---
"@agentyx/core": minor
"@agentyx/cli": minor
"@agentyx/adapters": patch
---

Add deterministic project discovery: `agentyx recommend` reads `package.json` and a small set of
known repository files (Dockerfile, `.github/workflows`, workspace markers) and suggests built-in
packs and optional capabilities with a human-readable reason each. No network access, no telemetry,
no LLM, and no writes — `init` and `doctor` use the same engine for defaults and advisory
suggestions, but enabling anything remains an explicit, separate step.

Also, while auditing the capabilities this makes discoverable:

- The `session-doctor-bootstrap` hook now runs `npx --no-install agentyx doctor --hook`, so a
  missing local `agentyx` binary fails fast instead of risking a lookup of a package that does not
  exist under that name. `doctor` now reports `hook_runtime_unavailable` when the hook is active but
  `@agentyx/cli` is not installed as a project dependency.
- Built-in MCP servers declare a `runtime` (`"local"` or `"may-download"`) so `mcp show` and
  `pack show` say upfront whether enabling a capability can fetch a package on first launch, and the
  `npx`-launched servers (`playwright`, `chrome-devtools`, `supabase`) pin a known-compatible version
  instead of `@latest`.
