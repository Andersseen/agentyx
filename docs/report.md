# Project report

`agentyx report` writes a single HTML file that shows the project-local Agentyx harness as it is
right now. It is a view of existing state, never a second source of truth: configuration, resolution,
Doctor, the lock and the provider adapters keep their meaning, and the report only presents them.

```sh
agentyx report                               # agentyx-report.html
agentyx report --output reports/harness.html
agentyx report --overwrite
```

- `--output <path>`: a project-relative path ending in `.html`, in a directory that already exists.
  Absolute paths, `..` traversal and symlinks that leave the project are rejected
  (`report_output_path_invalid`).
- `--overwrite`: replace the requested file. Without it an existing file is an error
  (`report_output_exists`) and its bytes are untouched. A replacement is written to a temporary file in
  the same directory and renamed into place. A failed write is `report_write_failed`.

The command needs a valid `.agentyx.json` and fails with the usual configuration error otherwise;
it never writes a partial report. A valid project that is unhealthy (missing lock, incomplete
installation, failed prerequisites, Doctor warnings or errors) still produces a report, and
generating one is not the same as passing `doctor --check`.

The only file the command writes is the report. It does not run project commands, call MCP servers or
providers, use the network, or change `.agentyx.json`, `.agentyx.lock.json`, provider files, hooks or
observations. The report is not an installed Agentyx file and is not recorded in the lock.

## Sections

| Section         | What it shows                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Overview        | Project identity, configuration/installation/prerequisite readiness, locked resolution, targets, counts, desired state |
| Harness         | Skills, MCP servers, tools, hooks and agents: selected, available-but-disabled or excluded, with the reason and contributing packs |
| Providers       | Per configured target: Skill location, MCP, hooks and agents Agentyx can render, observed-session state    |
| Readiness       | Doctor's readiness states, status and diagnostics                                                          |
| Reproducibility | Lock presence and version, snapshot availability, locked comparison and its differences                    |
| Installation    | Entries recorded in `.agentyx.lock.json`, grouped by kind, with recorded/missing/edited/stale state        |
| Project graph   | Agentyx's own SVG when a project graph is configured, otherwise a "not configured" note                    |

Reproducibility and installation are shown separately on purpose: a matching lock says the reviewed
inputs are unchanged, not that files are installed, and the reverse. Ownership comes only from lock
entries; a capability that merely resolves is never listed as owned.

## Data and privacy boundary

Included: project name, id and description, pack/capability/provider names, Doctor diagnostics
(with machine paths replaced), project-relative managed paths, safe lock differences ("configuration
changed", "skill foo changed"). Environment variable and header *names* can appear inside Doctor's
diagnostic wording; values never do.

Never included: Skill or agent instruction bodies, hooks' command output, environment or header
values, secrets, raw `.agentyx.json` or lock contents, hashes, snapshot JSON, absolute or home paths,
usernames, session ids, prompts or transcripts. All project-derived text is HTML-escaped. The only
raw markup is the SVG that `renderProjectGraphSvg` produces, which escapes every label itself and is
covered by regression tests for hostile names.

Project and capability names and diagnostics are present on purpose. Review the file before sharing.

## Determinism

The same CLI version, `.agentyx.json`, local Skill sources, lock, Doctor-relevant provider files and
local environment produce byte-identical HTML: no timestamp, duration, random id, host or path.
Prerequisite results (commands on `PATH`, environment variable presence) come from the machine that
runs the command, so the same project can legitimately differ between machines.

## Offline, single file

The document inlines its CSS, a small script and the graph SVG. It has no external links, fonts,
images, `fetch`, frames or CDN, and a restrictive Content-Security-Policy meta tag
(`default-src 'none'`, `connect-src 'none'`; inline style and script only). It opens from `file://`.
Everything is readable with JavaScript disabled; scripting only adds a capability filter and a theme
toggle. It follows `prefers-color-scheme`, uses semantic landmarks and tables, shows state with text
and a glyph as well as colour, and respects `prefers-reduced-motion`.

## What the report does not prove

The report is observational. It does not show model quality, that a provider loaded or used a Skill,
remote MCP health, agent activation (unless observation evidence is recorded, and even then only as
"sessions recorded"), the R100 practical-usefulness gate, or identical behavior across agents.
"Renderable" means Agentyx can write configuration for a provider, not that the provider runs it.

## Development

The report template is authored with Flowview in `packages/cli/src/report/templates/report.flow` and
compiled ahead of time into the committed `report-renderer.generated.js`. The data flows one way:
domain state, then `ReportModel` (`report/model.ts`), then a display view (`report/view.ts`), then the
generated render function. Flowview only renders; it makes no domain decision.

- `pnpm report:generate` regenerates the renderer after editing the template.
- `pnpm report:check` fails when the committed renderer differs from the template; `pnpm check` runs it.
- `@flowview/compiler` (exact version, WASM) is a development dependency and is never loaded by the CLI.
  The published CLI depends only on the tiny `@flowview/runtime`, pinned exactly.
