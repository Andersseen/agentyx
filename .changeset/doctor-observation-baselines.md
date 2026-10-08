---
"@agentyx/core": minor
"@agentyx/cli": minor
"@agentyx/adapters": minor
---

Doctor usage is now configuration-aware: sessions are tied to a fingerprint of the installed harness (`usage-v2.jsonl`), so changing the harness starts a fresh baseline, old sessions can no longer make a newly enabled capability look dormant, and negative evidence is withheld while installation is pending or a provider's observer hooks are not installed.
