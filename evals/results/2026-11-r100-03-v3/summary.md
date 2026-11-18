# Measured behavior results

Gate: **failed**

Valid runs: 84/84

## Provider outcomes

| Provider | Baseline correct | Agentyx correct | Baseline interventions | Agentyx interventions | Baseline instruction use (observed / not / unknown) | Agentyx instruction use (observed / not / unknown) |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| codex | 18/21 | 17/21 | 0 | 0 | 0 / 21 / 0 | 4 / 0 / 17 |
| claude | 21/21 | 21/21 | 0 | 0 | 0 / 21 / 0 | 13 / 0 / 8 |

## Scenario outcomes

| Category | Baseline passed | Agentyx passed | Per-provider correctness (baseline → Agentyx) | Baseline interventions | Agentyx interventions |
| --- | ---: | ---: | --- | ---: | ---: |
| bug-fix | 3/6 | 3/6 | codex 0/3 → 0/3; claude 3/3 → 3/3 | 0 | 0 |
| api-change | 6/6 | 6/6 | codex 3/3 → 3/3; claude 3/3 → 3/3 | 0 | 0 |
| safe-refactor | 6/6 | 6/6 | codex 3/3 → 3/3; claude 3/3 → 3/3 | 0 | 0 |
| command-discovery | 6/6 | 6/6 | codex 3/3 → 3/3; claude 3/3 → 3/3 | 0 | 0 |
| irrelevant-skill-restraint | 6/6 | 6/6 | codex 3/3 → 3/3; claude 3/3 → 3/3 | 0 | 0 |
| instruction-coexistence | 6/6 | 6/6 | codex 3/3 → 3/3; claude 3/3 → 3/3 | 0 | 0 |
| project-context-verification | 6/6 | 5/6 | codex 3/3 → 2/3; claude 3/3 → 3/3 | 0 | 0 |

Documented benefit categories: 0
Critical failures: 0
Missing runs: 0
Invalid records: 0
Matched-pair metadata problems: 0

A passing gate is scoped internal evidence and does not establish universal superiority.
