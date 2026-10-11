---
"@agentyx/adapters": patch
"@agentyx/cli": patch
---

Harden installs against stale plans and partial failures. Every planned write or deletion now records the destination state it observed, and the executor revalidates it before the first write and again before each change, so a file created or edited after planning (including a user edit to `.mcp.json` or `.claude/settings.json`, and including under `--force`) is never overwritten or deleted and fails with `stale_install_plan`. A failure after earlier changes now fails with `incomplete_install`, listing completed and not-applied paths; nothing is rolled back and the lock is committed only after every provider change succeeded. `.agentyx.lock.json` is replaced through a same-directory temporary file and a rename. `configure --sync` keeps these codes.
