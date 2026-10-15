---
"@agentyx/core": minor
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Add `agentyx doctor --locked` and `agentyx install --frozen`. `doctor --locked` compares the current
harness inputs (configuration, selected Skill sources, exact CLI version) with the complete
resolution snapshot in the version-2 lock and reports a structured `reproducibility` state; any
locked contract failure exits 1. `install --frozen` re-checks that snapshot and may only restore a
missing Skill file the lock already owns; it rejects every other change and never rewrites the lock.
Adapters gain a `read-only` lock commit intent and a frozen-plan validator.
