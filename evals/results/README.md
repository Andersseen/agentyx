# Sanitized benchmark results

Commit results only after genuine provider trials, under
`<evaluation-id>/metadata.json`, `runs.jsonl`, and `summary.md`. Records must be sanitized and
validated by `node scripts/evaluate-behavior.mjs summarize --results <directory>`. Never commit raw
provider transcripts, credentials, absolute temporary paths, or synthetic evidence. No result
directory means no behavioral conclusion.

`metadata.json` includes `evaluationDate`, `agentyxSha`, `packageVersion`, `benchmarkVersion`,
`benchmarkSha256`, `providers`, `providerVersions`, `modelSettings`, and `repetitions`. Record the
trial date/window, commit SHA and package version, definition hash, both provider CLI versions, and
models/settings where known. `modelSettings` maps each provider to `{ model, modelStatus,
settingsFingerprint }`; unknown models use `model: null` and `modelStatus: "unknown"`. Pair-level
model/settings and the initial fixture hash are also required on every run record so the summary can
reject mismatched comparisons.
