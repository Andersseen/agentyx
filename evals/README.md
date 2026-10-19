# Agentyx Skill evaluations

This suite is the provider-neutral semantic check for whether selected packs contribute their
expected Skills. It does not execute agents or measure behavior.

`pnpm eval:skills` validates that every scenario is well formed and that its expected Skills are
actually contributed by the selected packs. The prompts and expected behaviours are intentionally
data, so the same suite can later be executed against Codex, Claude Code, Kimi Code, or a human
review without putting provider calls in `@agentyx/core`.

When a Skill changes materially, add or update a scenario. The separate measured benchmark is
documented in [behavior/README.md](behavior/README.md). The semantic suite remains provider-free.
