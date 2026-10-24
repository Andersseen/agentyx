---
title: Packs
description: The 17 built-in capability packs, what each contributes, and how optional capabilities are activated.
group: Reference
order: 20
---

A pack is a composable bundle of provider-neutral capabilities. Packs are data, not code: adding one
is an entry in the built-in registry, and resolution never grows a branch per pack.

Select them in `.agentyx.json` or with `agentyx configure --add-pack <name>`:

```json
{ "packs": ["technical", "typescript", "efficiency"] }
```

Packs come out in the order requested, with no inheritance. `resolve typescript testing security`
lists exactly those three.

## The catalogue

| Pack | Category | Purpose |
| --- | --- | --- |
| `technical` | engineering | General engineering quality, API design and code review. |
| `typescript` | language | Strict, modeled and modern TypeScript. |
| `rust` | language | Idiomatic Rust, safe filesystem work and Cargo checks. |
| `angular` | framework | Modern Angular architecture, signals and tests. |
| `efficiency` | efficiency | Less context and tool overhead without weaker verification. |
| `agentic` | workflow | Planning, debugging, review and substantial agent work. |
| `testing` | engineering | Choose test levels and keep end-to-end suites stable. |
| `ui-ux` | design | Make product interfaces clearer, more coherent and easier to verify. |
| `security` | engineering | Handle untrusted input, secrets and access safely. |
| `performance` | engineering | Profile before optimizing browsers, apps and queries. |
| `accessibility` | engineering | Build usable markup and keyboard interactions. |
| `refactoring` | engineering | Restructure code safely, including legacy systems. |
| `documentation` | engineering | Write useful technical docs and decisions. |
| `observability` | engineering | Design logging, metrics, tracing and incident response. |
| `data` | engineering | Model schemas, migrations and transactions. |
| `git` | workflow | Keep commits, branches and pull requests reviewable. |
| `devops` | workflow | Make CI, containers and deployment safer. |

A capability two packs both contribute counts once.

## Optional capabilities

Some capabilities are declared but inactive until you enable them explicitly, so a pack never turns
on a network-reaching server or an extra agent behind your back:

```bash
pnpm dlx @agentyx/cli resolve efficiency              # shows rtk as "disabled (optional)"
pnpm dlx @agentyx/cli resolve efficiency --enable rtk
```

```json
{ "packs": ["efficiency"], "enable": ["rtk", "codebase-memory"] }
```

Optional capabilities include local tools such as `rtk`, the MCP servers listed below, and the
project agents from the `agentic` pack (`agentyx-planner`, `agentyx-reviewer`, `agentyx-verifier`).

## Built-in MCP servers

Seven provider-neutral definitions ship with Agentyx. Each is rendered into the target provider's own
document format; the definition itself names no provider.

| Server | Contributed by |
| --- | --- |
| `context7` | `angular` |
| `playwright` | `testing`, `ui-ux` |
| `codebase-memory` | `efficiency` |
| `github` | `git` |
| `sentry` | `observability` |
| `chrome-devtools` | `performance`, `accessibility` |
| `supabase` | `data` |

Agentyx never downloads binaries, runs installers, edits `PATH`, or installs third-party runtime
Skills. Some capabilities do launch a command that can: an MCP server started through `npx` may fetch
that package from the registry the first time a provider runs it. `agentyx mcp show <name>` and
`agentyx pack show <pack>` print that distinction (`runtime: local` vs `runtime: may-download`)
before you enable anything.

## Inspecting a pack

```bash
pnpm dlx @agentyx/cli pack list
pnpm dlx @agentyx/cli pack show efficiency
pnpm dlx @agentyx/cli skill list
pnpm dlx @agentyx/cli skill show planning
pnpm dlx @agentyx/cli mcp show context7
```

`resolve` prints identifiers only, never Skill contents.
