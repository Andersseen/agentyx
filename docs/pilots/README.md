# Agentyx real-project pilots

This plan prepares three project pilots without claiming that one has run. Find a project owner for
each row; at least one person should not be the Agentyx implementer. Obtain provider access through
each pilot operator. Keep private repository details, transcripts, credentials and personal data
out of this repository.

| Pilot | Required profile | Status | Operator / date | Result record |
| --- | --- | --- | --- | --- |
| TypeScript project | Small app or library with existing checks | Pending | — | — |
| Angular app | Existing Angular project with its real package scripts | Pending | — | — |
| TypeScript monorepo | Multiple packages with different working directories | Pending | — | — |

## Record for each pilot

Use a fresh checkout and record the Agentyx CLI version, provider and version, OS, package manager,
configured packs and targets. Record what required explanation or correction. Do not include prompt
or source contents in the shared result.

Complete and record these six workflows:

1. **Fresh setup:** run recommend, init, inspect `sync --dry-run`, install, then Doctor. Explain why
   one selected pack fits and confirm that optional MCP servers remain disabled until selected.
2. **Adjustment:** remove one selected capability with a typed exclusion, sync it, and confirm that
   unrelated Skills and provider settings survive.
3. **Project fit:** add one existing project command and one repository constraint to project context.
   Start a fresh agent session; ask it to use the command and follow the constraint. Record whether it
   discovers and follows them without a reminder.
4. **Reproduction:** pin the exact CLI, commit the configuration and reviewed lock, then restore a
   missing Agentyx-owned Skill with frozen install. Confirm that the lock stays unchanged.
5. **Conflict recovery:** edit a managed file, observe the conflict, and recover after reviewing the
   content. Confirm Agentyx does not replace the edit without an explicit reviewed choice.
6. **Removal:** uninstall and confirm that user Skills, unmanaged files, unrelated MCP keys and
   hooks remain intact.

For at least one project, record whether each configured provider discovers a Skill and which MCP
transport was actually tried. Installation or rendered configuration alone is not runtime evidence.
Record observed use separately from task correctness and human interventions. Never describe usage
or session rates as a measure of usefulness.

| Workflow | Completed | Help needed | Confusion / failure | Evidence reference |
| --- | --- | --- | --- | --- |
| Fresh setup | Pending | — | — | — |
| Adjustment | Pending | — | — | — |
| Project fit | Pending | — | — | — |
| Reproduction | Pending | — | — | — |
| Conflict recovery | Pending | — | — | — |
| Removal | Pending | — | — | — |

At closeout, classify findings as release blocker, patch, or post-1.0 request. A blocker includes
loss of user content, false success, an unrecoverable documented path, secret disclosure, or a
provider integration that cannot discover its installed Skill. Retest the affected workflow after a
fix. Empty rows mean pending evidence; they are never pass results.
