# R100-03 benchmark v2 Codex run — invalidated

Date: 2026-11-18. Agentyx `main` at `ac32a5f62cf10d63b0185cb3d823971c41ebb646`, packages `0.24.0`.
Benchmark v2 SHA-256: `4a75e838df784629e5c9c05910219ded0bf3ad65fa2db2ee292159aed33b94f8`.
Codex CLI `codex-cli 0.170.0`, model `gpt-6-luna` (reasoning effort `medium`), ChatGPT login,
`exec --ephemeral -s workspace-write`, fresh fixture per run.

All 42 planned Codex runs completed. They are **not** release evidence and no run records are kept,
because the run exposed two benchmark defects that made version 2 unable to produce a valid result:

- **Checker defect.** `project-context-verification/check.mjs` imported `./src.mjs` relative to the
  canonical checker file, not the run directory, so it always tested the unmodified source. All six
  runs failed in both conditions although the agent's fix was correct when checked in place.
- **No discriminative power.** Every objective checker was copied into the run as `check.mjs`, so the
  agent could read and run the exact expected assertions, and four prompts dictated the practice the
  treatment Skills teach (for example "Add or update regression checks and verify the change").
  The other six scenarios passed 18/18 in both conditions, as in the v1 preflight (36/36).

| Scenario | Baseline | Agentyx |
| --- | ---: | ---: |
| bug-regression | 3/3 | 3/3 |
| api-change | 3/3 | 3/3 |
| safe-refactor | 3/3 | 3/3 |
| command-discovery | 3/3 | 3/3 |
| irrelevant-skill | 3/3 | 3/3 |
| instruction-coexistence | 3/3 | 3/3 |
| project-context-verification | 0/3 (checker defect) | 0/3 (checker defect) |

This was the one benchmark revision allowed in the validation closeout: version 3 fixes the checker,
moves every objective checker outside the run directory, and states only the user's goal in four
prompts. See [behavior/README.md](../../behavior/README.md). No v2 run counts toward the gate.
