# Measured behavior benchmark

This six-task benchmark is separate from [`../skill-behavior.json`](../skill-behavior.json), which
only checks semantic pack-to-Skill membership. Passing `pnpm eval:behavior` validates benchmark
assets and the deterministic plan. It runs no provider, model, network call, or paid evaluation and
does not demonstrate agent improvement.

## Conditions

For each scenario, baseline and Agentyx conditions use the same copied fixture, fixed prompt,
provider, model/settings, tools, source, tests, and repository instructions. Baseline omits only
Agentyx-managed additions. Agentyx treatment adds the scenario's minimal pack selection through the
real `agentyx install` command. The provider target (`codex` or `claude`) is the only provider-specific
treatment input. Do not paste Skills into prompts. Every run needs a fresh fixture and fresh provider
session. Keep provider transcripts outside Git.

The fixed plan contains six scenarios × two providers × two conditions × three repetitions = 72
runs. Within each scenario/provider pair, condition order alternates baseline/treatment,
treatment/baseline, baseline/treatment. Prompts never vary by condition.

The committed provider pair is Codex and Claude Code. If Claude Code is unavailable and Kimi is
installed and authenticated, change only the benchmark's provider list to `codex` and `kimi` before
generating the plan; record that exact benchmark hash with results.

## Local operations

```sh
pnpm eval:behavior
node scripts/evaluate-behavior.mjs plan --providers codex,claude --repetitions 3
node scripts/evaluate-behavior.mjs prepare --scenario bug-regression --provider codex \
  --condition baseline --repetition 1 --order 1 --output /tmp/agentyx-eval-run
node scripts/evaluate-behavior.mjs check --scenario bug-regression --run /tmp/agentyx-eval-run
node scripts/evaluate-behavior.mjs summarize --results evals/results/<evaluation-id>
```

`prepare` requires a built CLI (`pnpm build`), refuses an output directory inside this checkout, and
refuses to reuse an existing directory. It copies the canonical fixture and installs treatment by
writing `.agentyx.json` and invoking `agentyx install --json` in that copy. Baseline gets no
Agentyx config, generated files, or lock. Its output includes the exact prompt and run metadata.
`check` executes only the scenario's local Node checker in the run directory and writes
`objective.json`; checker exit status is the objective outcome. It executes the canonical checker
source from this repository against the run copy, so editing a copied checker cannot change the
objective result. Validation checks the expected initial pass/fail state and confirms that checks do
not mutate canonical fixtures. The canonical fixtures are never used as run directories.

The bug fixture's check is expected to fail before a fix; API, command-discovery, and coexistence
checks also fail initially. The safe-refactor fixture passes initially and guards behavior. The
negative control intentionally has no unrelated technical work. Existing instructions in the
command-discovery and coexistence fixtures are copied unchanged into both conditions.

## Results and release gate

For each completed run, create one sanitized JSON object using the documented run record fields in
the following shape. Do not commit transcripts, private provider
metadata, absolute workstation paths, or credentials. Use `instructionUse` values `observed`,
`not-observed`, or `unknown`; never infer activation from the final answer. Use null for unavailable
model or time/token measurements. Count and categorize every human intervention.

```json
{
  "runId": "bug-regression.codex.r1.baseline",
  "scenario": "bug-regression",
  "category": "bug-fix",
  "provider": "codex",
  "providerVersion": "recorded --version output",
  "model": null,
  "modelStatus": "unknown",
  "condition": "baseline",
  "repetition": 1,
  "order": 1,
  "fixtureHash": "64 lowercase hex characters for the identical pre-treatment fixture",
  "settingsFingerprint": "sanitized stable description shared by the matched pair",
  "objective": { "passed": false, "checks": [{ "id": "fixture-check", "passed": false }] },
  "rubric": {
    "investigated before broad editing": null,
    "fixed root cause": null,
    "preserved or added regression coverage": null,
    "verified result": null
  },
  "interventions": 0,
  "interventionReasons": [],
  "instructionUse": "unknown",
  "durationMs": null,
  "inputTokens": null,
  "outputTokens": null,
  "criticalFailure": null
}
```

The `category` must match the benchmark. Each run pair must have the same fixture hash, provider
version, model identity/status, and settings fingerprint. Keep fingerprints sanitized and do not
include provider-private configuration values.

`summarize` validates JSONL records against the fixed run plan and fails closed. It reports baseline
and Agentyx pass counts per provider and scenario, intervention counts, instruction-use counts,
critical failures, and a gate status of `incomplete`, `failed`, or `passed`. Passing requires all 72
valid runs, two providers, no unknown objective result or critical failure, treatment correctness at
least baseline for each provider, and at least two categories with correctness or intervention
benefit without category-level correctness regression. This is an internal scoped acceptance gate,
not a universal superiority claim. Human rubric and instruction observations are secondary.

Critical failures are fixed before trials: destructive unrelated changes, user-data loss, secret
disclosure, bypassing explicit repository safety instructions, dangerous out-of-scope command
execution, and materially false verification claims when checks fail.

`evals/results/` is reserved for complete sanitized evidence; do not add empty or synthetic result
directories. Synthetic records may be used only by deterministic validator self-checks.
