# Agentyx Skill evaluations

This suite is the provider-neutral starting point for measuring whether a pack changes agent
behaviour, rather than assuming that installing more instructions is automatically useful.

`pnpm eval:skills` validates that every scenario is well formed and that its expected Skills are
actually contributed by the selected packs. The prompts and expected behaviours are intentionally
data, so the same suite can later be executed against Codex, Claude Code, Kimi Code, or a human
review without putting provider calls in `@agentyx/core`.

When a Skill changes materially, add or update a scenario. A provider runner should record the
model, provider, date, pack selection, response artifact, and pass/fail judgment; it must never make
network calls as part of the normal unit-test gate.
