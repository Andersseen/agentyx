---
title: Configuration
description: Every field of .agentyx.json — packs, optional capabilities, exclusions, targets, local Skills, project metadata and context.
group: Start here
order: 2
---

`.agentyx.json` is the desired state for this project. Provider files never rewrite it: `configure`
edits it, and `sync` converges installed state onto it. Unknown keys are rejected rather than
ignored, and invalid configuration always throws a descriptive error — Agentyx never silently
repairs it.

```json
{
  "packs": ["technical", "typescript", "efficiency"],
  "enable": ["rtk", "codebase-memory"],
  "targets": ["codex", "claude", "kimi", "qwen"]
}
```

## Core fields

| Field | Type | Meaning |
| --- | --- | --- |
| `$schema` | string, optional | Path or URL to the Agentyx JSON Schema, for editor completion. |
| `packs` | string[] | Capability packs this project selects. Defaults to `[]`. |
| `enable` | string[] | Optional capabilities to activate by id, lowercase kebab-case. Defaults to `[]`. |
| `exclude` | object, optional | Typed capabilities to remove from the selected packs. |
| `targets` | string[] | Coding-agent providers this project targets. Defaults to `[]`. |
| `skillDirectories` | string[], optional | Project-relative roots whose direct children are Agent Skills. |
| `localPacks` | object[], optional | Project-owned packs referencing built-in or local Skills. |
| `trustedSources` | object[], optional | Pinned local checkouts of known external skill or plugin sources. |
| `project` | object, optional | Identity and ownership for this project. |
| `relations` | object[], optional | Direct architectural relationships to other projects. |
| `context` | object, optional | Explicit repository-local facts for the generated project context Skill. |

`targets` stays an open list of strings on purpose, so a third-party adapter can register a provider
without a schema change. The built-in ids are `codex`, `claude`, `kimi` and `qwen`.

## Excluding a capability

Exclusions are typed, so removing a Skill cannot accidentally remove an MCP server of the same name:

```json
{
  "packs": ["efficiency", "testing"],
  "exclude": {
    "skills": ["flaky-tests"],
    "mcpServers": ["playwright"],
    "tools": ["rtk"],
    "hooks": ["observe-tool-use"],
    "agents": ["agentyx-reviewer"]
  }
}
```

Each list defaults to `[]`.

## Skill directories and local packs

`skillDirectories` points at vendored Skills. Paths must be portable and project-relative: absolute
paths, Windows drive letters, backslashes and parent traversal are all rejected.

```json
{
  "skillDirectories": ["local-skills"],
  "localPacks": [
    {
      "name": "local-smoke",
      "skills": ["local-smoke-skill"],
      "mcpServers": [{ "name": "playwright", "activation": "optional" }]
    }
  ]
}
```

Agentyx validates and installs the canonical Markdown from those directories. It performs no network
access and does not yet copy resource-bearing Skill trees (`scripts/`, `references/`, `assets/`).

## Project metadata, relations and context

These generate one canonical `agentyx-project-context` Skill, installed identically into every
target.

```json
{
  "project": {
    "id": "smoke-web",
    "name": "Smoke Web",
    "owns": ["frontend"]
  },
  "relations": [
    {
      "id": "smoke-api",
      "name": "Smoke API",
      "type": "consumes",
      "role": "backend-api",
      "owns": ["backend-api"]
    }
  ],
  "context": {
    "commands": { "test": { "command": "pnpm test", "cwd": "." } },
    "areas": [{ "path": "packages/core", "purpose": "Domain model." }],
    "constraints": ["Commands and graph metadata are descriptive."]
  }
}
```

`relations[].type` is one of `uses`, `integrates`, `consumes` or `extends`.

Three invariants are enforced:

- `relations` requires `project` metadata.
- A project cannot relate to itself, and relation ids must be unique.
- `context.areas[].path` entries must be unique.

Repository and documentation links are descriptive references. Agentyx does not fetch them, call
declared MCP servers, or infer relationships from package dependencies. Commands are never executed.

## Reading it back

```bash
pnpm dlx @agentyx/cli resolve            # what the current configuration resolves to
pnpm dlx @agentyx/cli resolve --explain  # why each capability is present
pnpm dlx @agentyx/cli recommend          # what this project's own files suggest, read-only
pnpm dlx @agentyx/cli graph              # declared project relationships
```

`recommend` is deterministic detection, not an AI feature: no network request, no telemetry, and no
model call decides a recommendation.
