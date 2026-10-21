---
"@agentyx/core": minor
"@agentyx/adapters": minor
"@agentyx/cli": minor
---

Add `agentyx report`, a deterministic, self-contained HTML report of the project's Agentyx harness:
desired state, why each capability is selected, providers, Doctor readiness, locked-resolution
comparison, lock-recorded ownership and the project graph. It is read-only apart from the requested
project-relative `.html` file (`--output`, `--overwrite`), works offline from `file://`, and omits
Skill bodies, secrets, hashes and absolute paths.
