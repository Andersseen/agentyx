# Provider preflight evidence

This directory holds sanitized, incomplete provider preflight artifacts. These records are useful
for preserving work while provider availability is being resolved; they do not count as a completed
benchmark and cannot satisfy the two-provider acceptance gate.

Complete release evidence belongs in `evals/results/`, which remains reserved for all 72 valid runs
from both providers. Keep partial evidence here and label it explicitly. Do not include raw agent
transcripts, credentials, or private provider configuration.

See [the October 2026 Codex preflight](2026-10-codex/summary.md) and the benchmark protocol in
[behavior/README.md](../behavior/README.md).
