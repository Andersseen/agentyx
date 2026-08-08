<div align="center">

# Agnox

**Provider-agnostic tooling for coding-agent environments.**

[![CI](https://github.com/Andersseen/agnox/actions/workflows/ci.yml/badge.svg)](https://github.com/Andersseen/agnox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-green.svg)](.nvmrc)

</div>

Agnox lets a project describe its development environment once, in a way that is not tied to any
single coding agent, and installs it into the agents you actually use:

```
.agnox.json
    ↓
  stacks
    ↓
capabilities
 /        \
skills    MCP
 \        /
 adapters
 /    |    \
Codex Claude Kimi
```

Today that runs end to end for Codex, Claude Code and Kimi Code from one set of skill and MCP
sources.

> **Status: early development.** APIs will change. Nothing is published to npm yet.

## Concept

A **stack** is a composable definition of a development environment. Stacks extend other stacks and
contribute **capabilities** such as skills and MCP servers, and Agnox resolves the full inheritance
chain in dependency-first order.

| Stack        | Extends      | Skills                                             | MCP        |
| ------------ | ------------ | -------------------------------------------------- | ---------- |
| `core`       | —            | `planning`, `systematic-debugging`, `verification` | —          |
| `typescript` | `core`       | `typescript-modern`                                | —          |
| `angular`    | `typescript` | `angular-modern`                                   | `context7` |

```
resolveStacks(["angular"])       ->  core → typescript → angular
resolveStackSkills(["angular"])  ->  planning, systematic-debugging, verification,
                                     typescript-modern, angular-modern
resolveStackMcpServers(["angular"]) -> context7
```

Stacks describe **development environments, not providers**. There is no `CodexStack` or
`ClaudeStack` or `KimiStack`; which agents you target is a separate axis (`targets`), and provider-specific
behaviour lives in adapters.

## Skills

A **skill** is reusable instruction text for a coding agent — provider-independent, with no install
path, permissions, or provider metadata attached. The model is deliberately three fields:

```json
{
  "name": "typescript-modern",
  "description": "Modern TypeScript conventions - strict types, inference, small explicit APIs.",
  "content": "..."
}
```

Built-in skills live as `SKILL.md` files in
[packages/core/skills](packages/core/skills), one directory per skill, with YAML frontmatter for the
metadata and the Markdown body as the instructions:

```md
---
name: planning
description: Plan non-trivial work before editing, and keep small changes small.
---

Instructions...
```

The frontmatter is a small flat `key: value` subset of YAML, so `@agnox/core` keeps depending on
Zod alone. Anything richer is rejected rather than guessed at, and a malformed built-in skill is a
build failure, not a silently skipped file.

Resolution works on **identifiers only** — skill bodies are read when something asks for them, so
`agnox resolve` never pays for the instruction text. Skills are resolved in stack order, then
declaration order, de-duplicated by first occurrence.

## MCP Servers

An **MCP server** is also authored once, without Codex or Claude fields attached. The initial model
is deliberately small: `stdio` servers have `command`, `args`, and environment variable references;
`http` servers have a `url` and optional header environment variable references. Agnox carries
environment variable names, never committed secret values.

Built-ins are intentionally limited to two examples:

- `context7` — remote HTTP at `https://mcp.context7.com/mcp`
- `playwright` — stdio via `npx @playwright/mcp@latest`

List them:

```sh
pnpm --silent agnox mcp list
```

Show provider-independent data:

```sh
pnpm --silent agnox mcp show context7
pnpm --silent agnox mcp show context7 --json
```

## Requirements

- Node.js >=22
- pnpm 10.30.1 (`corepack enable`)

## Setup

```sh
pnpm install
pnpm build
```

## `.agnox.json`

A project describes itself with `.agnox.json` in its root directory:

```json
{
  "$schema": "./node_modules/@agnox/core/schema/agnox.schema.json",
  "extends": ["angular"],
  "profile": "balanced",
  "targets": ["codex", "claude"]
}
```

| Field     | Type                                    | Default      | Meaning                                                       |
| --------- | --------------------------------------- | ------------ | ------------------------------------------------------------- |
| `extends` | `string[]`                              | `[]`         | Stacks this project builds on                                  |
| `profile` | `"lean" \| "balanced" \| "autonomous"`  | `"balanced"` | How much autonomy the generated environment grants             |
| `targets` | `string[]`                              | `[]`         | Coding agents this project targets                             |

`targets` is an open list of strings, not an enum, so third-party adapters can add providers later
without a schema change.

Parent directories are not searched, and an invalid configuration is reported rather than repaired.
A working example lives in [examples/angular/.agnox.json](examples/angular/.agnox.json) — it is a
configuration fixture, not an Angular project.

## `agnox resolve`

Resolve a stack without needing a project configuration:

```sh
pnpm agnox resolve angular
```

```
Stacks
  core
  typescript
  angular

Skills
  planning
  systematic-debugging
  verification
  typescript-modern
  angular-modern

MCP
  context7
```

Resolve the current project's `.agnox.json`:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs resolve
```

```
Agnox configuration

Profile
  balanced

Targets
  codex
  claude

Stacks
  core
  typescript
  angular

Skills
  planning
  systematic-debugging
  verification
  typescript-modern
  angular-modern

MCP
  context7
```

Add `--json` for machine-readable output. Use `pnpm --silent` so pnpm's own banner stays out of
stdout:

```sh
pnpm --silent agnox resolve angular --json
```

```json
{
  "requestedStacks": ["angular"],
  "resolvedStacks": ["core", "typescript", "angular"],
  "skills": [
    "planning",
    "systematic-debugging",
    "verification",
    "typescript-modern",
    "angular-modern"
  ],
  "mcpServers": ["context7"]
}
```

`resolve` prints skill and MCP identifiers, never skill contents or provider config, so its output
stays cheap to hand to an agent.

An explicit stack argument takes precedence over `.agnox.json` for stack selection. Unknown stacks,
unknown skills, circular inheritance, a missing file, malformed JSON, and schema violations all
print a readable message on stderr and exit with code 1.

## `agnox skill`

List the built-in skills:

```sh
pnpm --silent agnox skill list
```

```
planning
systematic-debugging
verification
typescript-modern
angular-modern
```

Read one, instructions included:

```sh
pnpm --silent agnox skill show angular-modern
```

```
angular-modern
Modern Angular conventions - standalone, signals, inject(), OnPush, zoneless.

# Modern Angular
...
```

`--json` gives the same skill as a `{ name, description, content }` document:

```sh
pnpm --silent agnox skill show angular-modern --json
```

An unknown skill prints a readable message on stderr and exits with code 1.

## `agnox target`

A **target** is a coding agent Agnox can install into. List them:

```sh
pnpm --silent agnox target list
```

```
codex
claude
kimi
```

`agnox target show <target>` adds the provider name and where it installs skills in the current
project:

```sh
pnpm --silent agnox target show codex
```

```
codex
Codex
Skills: .agents/skills (not present)
MCP: .codex/config.toml
MCP transports: stdio, http
Reference: https://developers.openai.com/codex/skills
Reference: https://developers.openai.com/codex/mcp
```

| Target   | Agent       | Project skill destination | Project MCP config     |
| -------- | ----------- | ------------------------- | ---------------------- |
| `codex`  | Codex       | `.agents/skills`          | `.codex/config.toml`   |
| `claude` | Claude Code | `.claude/skills`          | `.mcp.json`            |
| `kimi`   | Kimi Code   | `.agents/skills`          | `.kimi-code/mcp.json`  |

These are the providers' own documented project-local conventions — Codex and Kimi Code both read
repository skills from the shared `.agents/skills` directory, while Claude Code reads
`.claude/skills`. For MCP, Codex reads trusted project `.codex/config.toml` layers and uses
`[mcp_servers.<id>]`; Claude Code uses project `.mcp.json` with an `mcpServers` object; Kimi Code
uses project `.kimi-code/mcp.json` with an `mcpServers` object. Installation is project-local only:
Agnox never writes to `$HOME`.

Codex MCP is TOML, so Agnox parses and rewrites the file with a TOML library. Unrelated values and
MCP servers are preserved semantically, but comments and exact formatting may be normalized. Claude
and Kimi MCP are JSON, so Agnox parses, merges, and serializes deterministically. Kimi supports SSE
too, but Agnox's provider-neutral MCP model currently installs only `stdio` and HTTP definitions.

## `agnox install`

`install` resolves the project, turns the resolved skills into a plan per target, and writes it.
Always look first:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs install --dry-run
```

```
Agnox install (dry run)

codex -> .agents/skills
Skills
  create    .agents/skills/planning/SKILL.md
  create    .agents/skills/systematic-debugging/SKILL.md
  create    .agents/skills/verification/SKILL.md
  create    .agents/skills/typescript-modern/SKILL.md
  create    .agents/skills/angular-modern/SKILL.md
MCP
  create    .codex/config.toml (context7)

claude -> .claude/skills
Skills
  create    .claude/skills/planning/SKILL.md
  create    .claude/skills/systematic-debugging/SKILL.md
  create    .claude/skills/verification/SKILL.md
  create    .claude/skills/typescript-modern/SKILL.md
  create    .claude/skills/angular-modern/SKILL.md
MCP
  create    .mcp.json (context7)

Dry run: 12 to create, 0 to update, 0 unchanged. Nothing was written.
```

`--dry-run` runs the full resolution and produces the real plan; it just never touches the disk.
Drop it to install:

```sh
agnox install
```

```
Installed: 12 written, 0 unchanged.
```

Every skill and MCP server is installed from one source. `@agnox/core` renders the canonical
`SKILL.md` once and exposes one provider-independent MCP definition; adapters only decide where and
how each provider expects it. Re-running reports `unchanged` and writes nothing; editing a managed
entry makes the next run report `update` and restore it.

Install into a specific agent, whatever `.agnox.json` says — `--target` is repeatable, applies to
that run only, and never edits the configuration:

```sh
agnox install --target codex
agnox install --target codex --target claude --target kimi
```

A stack can be named directly, exactly as with `resolve`, which installs without a `.agnox.json` at
all. The configuration is then not read, so the target has to be explicit:

```sh
agnox install angular --target codex --dry-run
```

For inspection or focused rollout, `--skills-only` skips MCP configuration and `--mcp-only` skips
skill files.

`--json` prints the plan and nothing else — identifiers, statuses and project-relative paths, never
skill bodies:

```sh
pnpm --silent agnox install core --target codex --json --dry-run
```

```json
{
  "dryRun": true,
  "stacks": ["core"],
  "skills": ["planning", "systematic-debugging", "verification"],
  "mcpServers": [],
  "targets": ["codex"],
  "plans": [
    {
      "target": "codex",
      "name": "Codex",
      "skillsPath": ".agents/skills",
      "operations": [
        {
          "type": "write-file",
          "status": "create",
          "skill": "planning",
          "path": ".agents/skills/planning/SKILL.md"
        },
        {
          "type": "write-file",
          "status": "create",
          "skill": "systematic-debugging",
          "path": ".agents/skills/systematic-debugging/SKILL.md"
        },
        {
          "type": "write-file",
          "status": "create",
          "skill": "verification",
          "path": ".agents/skills/verification/SKILL.md"
        }
      ],
      "mcpOperations": [],
      "unsupportedMcp": []
    }
  ],
  "summary": { "create": 3, "update": 0, "unchanged": 0 }
}
```

Agnox only manages `<destination>/<skill>/SKILL.md` for skills it resolved and MCP entries it
resolved. Other skills, provider settings, and unrelated MCP servers are preserved; a plan that
would write outside the project is refused, and nothing is ever deleted. A target with no adapter,
or an installation with no target at all, prints a readable message on stderr and exits with code 1.

## Library use

```ts
import {
  builtInSkillRegistry,
  builtInMcpServerRegistry,
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
  resolveStackSkills,
  resolveStackMcpServers,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveStackSkills(["angular"]);
// ["planning", "systematic-debugging", "verification", "typescript-modern", "angular-modern"]

resolveStackMcpServers(["angular"]);
// ["context7"]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, skills, mcpServers, profile, targets }

builtInSkillRegistry.names; // identifiers, no file is read
builtInSkillRegistry.get("planning"); // { name, description, content }
builtInMcpServerRegistry.get("context7"); // { name, description, transport, url }
```

`createSkillRegistry(sources)` builds an independent registry from `{ name, load }` sources, which
is the seam an external registry would use later.

Installation lives in `@agnox/adapters`, and planning is always separate from writing:

```ts
import { applyInstallPlans, builtInAdapterRegistry, planInstall } from "@agnox/adapters";
import { builtInMcpServerRegistry, builtInSkillRegistry } from "@agnox/core";

const skills = ["planning", "angular-modern"].map((name) => builtInSkillRegistry.get(name));
const mcpServers = ["context7"].map((name) => builtInMcpServerRegistry.get(name));
const plans = await planInstall({
  targets: ["codex", "claude", "kimi"],
  projectDir,
  skills,
  mcpServers,
});
// one plan per target; no file has been touched

await applyInstallPlans(plans); // the only code that writes

builtInAdapterRegistry.ids; // ["codex", "claude", "kimi"]
```

`createAdapterRegistry(adapters)` builds an independent registry, and `createSkillDirectoryAdapter`
turns `{ id, name, skillsDir }` into an adapter for any agent that reads
`<directory>/<skill>/SKILL.md` — the seam a third-party adapter would use.

Resolution and installation failures throw domain errors — `UnknownStackError`,
`CircularStackDependencyError`, `UnknownSkillError`, `DuplicateSkillError`, `InvalidSkillError`,
`UnknownMcpServerError`, `DuplicateMcpServerError`, `InvalidMcpServerError`,
`AgnoxConfigNotFoundError`, `AgnoxConfigParseError`, `AgnoxConfigValidationError`,
`UnknownAdapterError`, `DuplicateAdapterError`, `MissingInstallTargetsError`, `InstallPathError`,
`ProviderConfigParseError` — all extending `AgnoxError` with a stable `code`.

## Packages

| Package                                     | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`@agnox/core`](packages/core)               | Configuration model, stacks, skills, MCP, resolution, JSON Schema |
| [`@agnox/cli`](packages/cli)                 | The `agnox` command-line interface                         |
| [`@agnox/adapters`](packages/adapters)       | Adapter contract, Codex and Claude Code adapters, install planning |

## Not implemented yet

Agnox installs skills and MCP configuration into Codex and Claude Code, project-locally, and
nothing more. Still to come: further providers (Kimi, OpenCode, Cursor), global installation into
`$HOME`, remote and community registries, token optimization, uninstall and sync cleanup, a plugin
system, project auto-detection, codebase memory, npm registry integration, an update system, and an
init wizard. `profile` is carried through resolution but does not change what is installed yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and the architecture rules that
keep Agnox provider agnostic. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), never
a public issue.

```sh
pnpm check   # biome + typecheck + test + build
```

## License

[MIT](LICENSE) © Andersseen
