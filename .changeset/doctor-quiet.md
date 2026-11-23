---
"@agentyx/cli": minor
---

Add `agentyx doctor --quiet` (`-q`): the text report shrinks to the status line plus warnings and
errors, so informational diagnostics such as "Runtime activity observation is not enabled" no longer
repeat on every run or in CI logs. `--quiet` combines with `--check` and `--locked`; it is rejected
with `--json` or `--hook`, which are already terse.
