# R100-03 Codex provider preflight

Date: 2026-10-21. Agentyx packages: `0.20.0`. Benchmark v1 SHA-256:
`74ee547cc73f57d5c4130b315b258a03944d539c7d9a121388ca97cc48cdc3fb`.

This is partial preflight evidence only. Codex completed 36 of the planned 72 runs. Claude Code was
unavailable, and Kimi Code was also unavailable. R100-03 remains pending; R100-04 has not started.
The full acceptance gate is incomplete, and this preflight does not establish behavioral
superiority.

## Provider and run conditions

- Codex CLI: `0.162.0-alpha.17.2`; authenticated through the existing ChatGPT login.
- Model identity was not exposed: `null`, status `unknown`.
- Each run used a fresh fixture and ephemeral session, the fixed benchmark prompt, and the same
  settings fingerprint: `codex:model-unknown:workspace-write:approve-for-me:ephemeral:skip-git-check`.
- The evaluator recorded sanitized run data only. Raw transcripts are not included.
- The 36 records in `runs.jsonl` were accepted by the canonical run-record validator. The canonical
  full-gate summarizer reports `incomplete`: 36 Claude runs are missing.

## Objective results

| Scenario | Baseline | Agentyx |
| --- | ---: | ---: |
| bug-regression | 3/3 | 3/3 |
| api-change | 3/3 | 3/3 |
| safe-refactor | 3/3 | 3/3 |
| command-discovery | 3/3 | 3/3 |
| irrelevant-skill | 3/3 | 3/3 |
| instruction-coexistence | 3/3 | 3/3 |
| **Total** | **18/18** | **18/18** |

Interventions: baseline 0; Agentyx 0. Critical failures: 0. Correctness and intervention counts were
equal across conditions, so no benefit category was demonstrated. Rubric observations were marked
true based on the recorded traces, diffs, and checks; they are secondary observations, not evidence
of comparative benefit.

Instruction use was observed in 0 of 18 baseline runs (18 not observed). In Agentyx runs it was
observed in 2, not observed in 0, and unknown in 16. “Not observed” does not mean “unused.”

## Next requirement

Run the same 36 matched Claude Code trials with the same benchmark and instruction set. Until then,
R100-03 remains pending and R100-04 must not start.
