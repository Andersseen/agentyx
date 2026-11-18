# Real-project pilots — November 2026 closeout

Date: 2026-11-18. Operator: the coding agent implementing this closeout (not independent; see
[Independent operator](#independent-operator)). Environment: macOS arm64, Node 22.23.1, pnpm 10.x.

Every pilot used a fresh clone of the repository's current default branch and a local branch that was
never pushed. No pull request, deployment, migration or cloud command was run in a pilot repository.
The Agentyx CLI was a packed local candidate of this branch, pinned as an exact `file:` tarball only on
the local pilot branch. Candidate 1 was `main` at `ac32a5f` (0.24.0). Candidates 2 and 3 added the
fixes listed under [Findings](#findings); every workflow touched by a fix was rerun on the later
candidate. No prompts, source contents, transcripts or credentials are recorded here.

| Pilot | Repository (category) | Starting commit | Agentyx state at start |
| --- | --- | --- | --- |
| 1 | `Andersseen/remove-local-branches` — small TypeScript VS Code extension with type-check, lint and test scripts | `39bed61` | none |
| 2 | `Andersseen/angular-movement` — Angular 22 library plus AnalogJS site | `f2e5d5e` | `@agentyx/cli ^0.9.0`, v1 lock, 90 entries, 4 user Skills, user MCP server and hooks |
| 3 | `Andersseen/DevFlare` — Nx 22 / pnpm monorepo, 8 apps and 2 libraries with per-app working directories | `218c365` | v1 lock, 77 entries, 8 user Skills, 7 user MCP servers, 3 user hook events |

Pilots 2 and 3 already used an older Agentyx. Each was first uninstalled with the candidate against
its legacy v1 lock, and the result was committed as the pre-Agentyx baseline for the fresh-setup run.

## Workflows

| Workflow | Pilot 1 | Pilot 2 | Pilot 3 |
| --- | --- | --- | --- |
| Legacy removal (v1 lock) | n/a | Pass — 86 removed; user Skills, `memory` MCP server, `PostToolUse`/`Stop` hooks and permissions kept; a Prettier-reformatted `.kimi-code/mcp.json` kept as edited | Pass — 74 removed; 7 user MCP servers, 3 hook events, Codex user servers and 8 user Skills kept |
| 1. Fresh setup | Pass — `technical`, `typescript`; 4 targets; 21 files; Doctor healthy | Pass — 6 recommended packs; `context7` active by default, `playwright`/`chrome-devtools` stayed disabled | Pass — 7 recommended packs; `playwright`, `sentry`, `supabase` stayed disabled |
| 2. Adjustment | Pass — `skill:api-design` excluded; 3 files removed, others and user files intact | Pass — `skill:containerization` excluded; user Skills, MCP and hooks intact | Pass — `mcp:context7` excluded from 4 provider files; 7 user servers intact |
| 3. Project fit | Codex: not observed on candidate 1; **observed on candidate 3** (opened the Skill and ran the configured `pnpm run check-types`) | Pending — Claude Code session not authenticated | Kimi: constraint and equivalent command followed; the same facts are in the repository's AGENTS.md and the Agentyx Skill was not opened, so attribution to Agentyx context is not observed |
| 4. Reproduction | Pass — deleted Skill restored byte-identical; lock unchanged; `doctor --locked --check` exit 0 | Pass (candidates 1 and 2) | **Failed on candidate 2** (frozen refused after the MCP exclusion); fixed; pass on candidate 3 — restored bytes match the lock hash, lock unchanged, locked Doctor exit 0 |
| 5. Conflict recovery | Pass — edited Skill kept, `sync`/frozen/`doctor --check` exit 1; recovered by moving the note to a user Skill | **Failed on candidate 1** (hand edit of the owned `context7` entry silently replaced); fixed; pass on candidate 2 — conflict, edit kept, recovered by renaming the custom entry | Pass (candidate 2) — enabling `playwright` refused to replace the project's own `playwright` server; recovered by keeping the user's server |
| 6. Removal | Pass — 48 removed; user Skills, MCP key and hooks semantically identical | Pending — after the Claude project-fit session | Pass — 77 removed; all user state kept |

## Provider Skill discovery (fresh sessions)

| Provider | Version | Result | Evidence |
| --- | --- | --- | --- |
| Codex | `codex-cli 0.170.0` | Observed | Pilot 1: a fresh read-only session listed all 7 installed Skills plus the user Skill |
| Kimi Code | `2.6.3` | Observed | Pilot 1: a fresh session listed all installed Skills plus both user Skills |
| Claude Code | `2.1.327` | Pending | Installed; the existing subscription login had expired and re-authentication is waiting on the account owner |

## MCP runtime evidence

Rendered configuration is not counted. No server needed credentials.

| Provider | Transport | Result |
| --- | --- | --- |
| Codex | stdio (`playwright`) | Not exercised. Codex loads project `.codex/config.toml` only after `codex exec --trust`, which persists trust in the user's Codex config; it was not granted (documented trust gate) |
| Kimi Code | stdio (`playwright`), http (`context7`) | Attempted in headless `-p` mode with per-invocation workspace trust. Kimi launched the stdio servers and closed them; no MCP tool reached the model for either transport. A hand-written config without Agentyx behaved the same, so this is a Kimi headless limitation, not an Agentyx rendering fault. Not runtime-verified |
| Claude Code | stdio, http | Pending authentication |

No MCP transport is runtime-verified yet.

## Findings

| Finding | Classification | Resolution |
| --- | --- | --- |
| A hand edit of an Agentyx-owned MCP server or hook entry, or a same-named entry the project wrote first, was replaced on `sync` without a conflict; Doctor reported nothing edited | Release blocker (silent overwrite) | Fixed: such entries are conflicts unless the definition changed since the lock snapshot; retested in pilots 2 and 3 |
| `install --frozen` and `doctor --locked` refused after excluding the last MCP server (empty provider config record) | Release blocker (frozen reproduction failure) | Fixed; retested in pilot 3 |
| Edited managed file reported as one Agentyx "does not manage"; same-named user entry reported as edited | Minor fix | Messages now name edited, not-written and differing-entry conflicts with matching recovery |
| Project-context Skill description gave lazily loading providers no reason to open it | Minor fix | Description now says when to read it and which commands it holds; Codex retest observed |
| Empty lock records remain after removing the last owned entry; Doctor counts them as managed files | Post-1.0 (cosmetic) | Unchanged; they own nothing |
| Shared JSON provider files are re-serialized with sorted keys | Post-1.0 (cosmetic) | Unchanged; content is semantically identical |
| `sync --dry-run` lists Kimi with no Skills when Codex writes the shared `.agents/skills`, and prints `()` for an update that only removes servers | Post-1.0 (cosmetic) | Unchanged |
| Codex project MCP and hooks need persistent trust; Kimi headless mode exposes no MCP tools | Provider limitation | Documented; not an Agentyx defect |

Pre-existing dangling `.claude/skills` symlinks in DevFlare's upstream branch were never recorded or
touched by Agentyx.

## Independent operator

Pending. The protocol requires at least one pilot run by someone other than the implementer. The
bounded package is [operator-package.md](operator-package.md). R100-04 is not complete until that
evidence and Claude Code discovery exist.
