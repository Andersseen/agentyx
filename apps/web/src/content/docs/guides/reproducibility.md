---
title: Reproducibility
description: How the lockfile records ownership, what frozen mode will and will not restore, and how to recover from a failed install.
group: Guides
order: 11
---

Agentyx only touches what it recorded. `.agentyx.lock.json` names every managed path and hashes its
content, which is what makes `sync`, `install --prune`, `uninstall` and `--frozen` safe.

Commit the lock. It is the reviewable record of the harness you approved, and it is what lets another
checkout reproduce it.

## Ownership rules

A destination that is not in the manifest, or whose content no longer matches the recorded hash, is a
**conflict**: never overwritten, never deleted, unless `--force` says so.

Deletion is restricted to manifest-recorded paths. It uses `rm` on single files and non-recursive
`rmdir` on the directories they leave behind, and never touches a provider MCP config file beyond the
server keys Agentyx added. This is what makes a shared directory such as `.agents/skills` safe to
write into.

Provider config files that you also edit — MCP documents, hook documents — are never claimed as a
whole. The lock records only the server and hook keys Agentyx added, so hand-editing `.mcp.json` or
`.claude/settings.json` is expected, not a conflict.

Entry kinds: `skill`, `agent`, `mcp`, `hook`, and `settings` for the one document a provider reads
both MCP servers and hooks from.

## Plan freshness

Agentyx plans first and writes second. A plan records, for every destination, the state it saw there:
absent, or present with a SHA-256 of its content. That record is internal and is not part of `--json`
output.

**A plan authorizes a change only against the exact state it observed.** Before the first write the
executor re-checks every destination; if any differs, it stops with `stale_install_plan`, naming the
project-relative paths, and nothing has been written. It checks each destination again immediately
before changing it.

So an entry you add to `.mcp.json` after a plan was made is never overwritten by the older merged
document.

- `--force` changes what the *planner* decides about the state it just read. It never means "overwrite
  whatever is there when the plan runs".
- A planned deletion whose file has already disappeared counts as done; one whose content changed is
  left alone.

## Frozen mode

`install --frozen` accepts only resources that are already satisfied and owned by the reviewed lock,
plus one narrow repair: a Skill file the lock owns, whose recorded hash equals the canonical content,
and which is missing from disk.

Everything else fails: updates, conflicts, deletions, agent/MCP/hook creation, ownership the lock does
not record, or ownership outside the desired selection. The failure codes are `frozen_stale_ownership`,
`frozen_restore_not_owned` and `frozen_installation_change_required`.

Frozen mode is a policy on top of the planner, not a second renderer, and it never edits the lock.

`doctor --locked` compares the current resolution against the lock's recorded snapshot instead of
reinstalling.

## Recovery

**Agentyx is not an atomic filesystem transaction.** If a write fails after earlier changes were made,
it stops with `incomplete_install` listing the project-relative paths that were `Completed` and those
`Not applied`. Nothing is rolled back. Changes already made stay, and the lock is committed last, only
after every provider change succeeded — so the previous lock remains authoritative. The lock is
replaced by a rename of a same-directory temporary file, so a failure before the rename leaves the
previous lock intact.

Concurrent Agentyx runs in one project are unsupported; the lock is not checked for outside changes
between loading and committing.

To recover:

1. Read the `Completed` and `Not applied` paths.
2. Run `agentyx doctor`.
3. Inspect each file reported as edited or not managed. Because the lock was not updated, a file
   written before the failure is not recorded as Agentyx-owned, and a managed file updated before the
   failure no longer matches the old lock. That is evidence of an interrupted run, not necessarily an
   edit of yours. Agentyx does not adopt such a file by itself; one whose bytes already equal what
   Agentyx wants is simply recognized as up to date.
4. Keep, move or restore each file deliberately. Use `--force` only after reviewing what it would
   replace.
5. Run `agentyx sync` again. A deletion that already happened is treated as done and is not recreated.

## Reproducing in a fresh checkout

Commit both `.agentyx.json` and `.agentyx.lock.json`, pin the CLI version in `package.json`, then:

```bash
pnpm install
pnpm exec agentyx doctor --locked --check
pnpm exec agentyx install --frozen
```

`--locked` tells you whether the current resolution still matches the reviewed snapshot; `--frozen`
restores only what that snapshot owns. See
[`docs/reproducibility.md`](https://github.com/Andersseen/agentyx/blob/main/docs/reproducibility.md)
for the exact pinning steps.
