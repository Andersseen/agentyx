---
name: worktree-workflow
description: Use git worktrees for isolated parallel implementation when the work warrants it.
---

# Worktree workflow

Use worktrees when isolation reduces risk for parallel or experimental implementation.

Check repository status before creating one. Use deterministic branch and directory names tied to
the task. Keep user changes safe: never overwrite or clean files you do not own. After integration,
remove temporary worktrees only when their work is preserved and no uncommitted changes remain.
