<div align="center">

# Agentyx

**One project-local coding-agent setup for Codex, Claude Code and Kimi Code.**

[![CI](https://github.com/Andersseen/agentyx/actions/workflows/ci.yml/badge.svg)](https://github.com/Andersseen/agentyx/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@agentyx/cli.svg)](https://www.npmjs.com/package/@agentyx/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-green.svg)](.nvmrc)

</div>

Agentyx is a small CLI for keeping coding-agent instructions and MCP setup consistent across the
tools your team actually uses. A project describes its environment once in `.agentyx.json`; Agentyx
resolves stack presets, Skills and MCP servers, then writes provider-specific project files for
Codex, Claude Code and Kimi Code.

> **Status: early development.** APIs will change.

## Why Agentyx

- **Provider agnostic by default.** Stacks, Skills and MCP servers are canonical data; adapters only
  translate them into each agent's expected project-local files.
- **Reviewable installs.** `agentyx install --dry-run` shows the exact files and paths before
  anything is written.
- **Project-local only.** Agentyx writes inside the current project and never mutates `$HOME`,
  global agent settings or secret values.
- **Composable presets, manual escape hatches.** Use stacks such as `typescript` and `angular`, or
  directly select individual Skills and MCP servers when you want a smaller setup.

## Quick Start

Install the published CLI globally if you want to run `agentyx` directly from any project:

```sh
pnpm add -g @agentyx/cli
```

Then, in an existing TypeScript or Angular project:

```sh
agentyx init
agentyx doctor
agentyx install --dry-run
agentyx install
```

For a focused one-off install without a stack preset:

```sh
agentyx install --select
agentyx install --target codex --skill planning --skill verification --mcp context7 --dry-run
```

If you prefer a project-local dependency instead of a global command:

```sh
pnpm add -D @agentyx/cli
pnpm exec agentyx doctor
```

## What It Writes

| Target   | Agent       | Skills path       | MCP config             |
| -------- | ----------- | ----------------- | ---------------------- |
| `codex`  | Codex       | `.agents/skills`  | `.codex/config.toml`   |
| `claude` | Claude Code | `.claude/skills`  | `.mcp.json`            |
| `kimi`   | Kimi Code   | `.agents/skills`  | `.kimi-code/mcp.json`  |

Every generated skill comes from the same canonical `SKILL.md`. MCP definitions are also
provider-neutral; adapters render them as TOML or JSON only at install time.

## Core Commands

```sh
agentyx init                 # create .agentyx.json
agentyx doctor               # diagnose config, targets and installability
agentyx resolve angular      # preview stack, Skill and MCP resolution
agentyx skill list           # list built-in Skills
agentyx mcp list             # list built-in MCP servers
agentyx install --dry-run    # show the exact write plan
agentyx install              # apply the plan
```

From this repository checkout, for local development:

```sh
pnpm install
pnpm build
```

Then run the built CLI from another project:

```sh
node /path/to/agentyx/packages/cli/dist/index.mjs init
node /path/to/agentyx/packages/cli/dist/index.mjs doctor
node /path/to/agentyx/packages/cli/dist/index.mjs install --dry-run
node /path/to/agentyx/packages/cli/dist/index.mjs install
```

For agents and CI, use non-interactive init:

```sh
agentyx init --stack angular --profile lean --target codex --target kimi --yes
```

`init` only creates `.agentyx.json`; it never installs Skills or MCP. `doctor` is deterministic
diagnostics, `install --dry-run` shows the exact project-local writes, and `install` performs them.

## Local Package Validation

For release-style testing without publishing, pack the workspace artifacts and execute the packaged
CLI in a temporary external project:

```sh
pnpm smoke:pack
```

This validates the package tarballs rather than workspace source imports, including the CLI bin,
runtime dependencies, built-in Skill assets, JSON Schema packaging, adapters, `init`, `doctor`,
`resolve`, and `install --dry-run`.

The generated `.agentyx.json` intentionally omits `$schema` for now. `@agentyx/core` packages
`schema/agentyx.schema.json`, but a relative `node_modules` schema path is fragile before packages are
installed and Agentyx does not yet host a stable public schema URL.

```
.agentyx.json
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

## Concept

A **stack** is a composable definition of a development environment. Stacks extend other stacks and
contribute **capabilities** such as skills and MCP servers, and Agentyx resolves the full inheritance
chain in dependency-first order.

| Stack        | Extends      | Skills                                             | MCP                              |
| ------------ | ------------ | -------------------------------------------------- | -------------------------------- |
| `core`       | —            | `planning`, `systematic-debugging`, `verification` | —                                |
| `typescript` | `core`       | `typescript-modern`                                | —                                |
| `angular`    | `typescript` | `angular-modern`                                   | `context7` at `recommended` level |

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

The frontmatter is a small flat `key: value` subset of YAML, so `@agentyx/core` keeps depending on
Zod alone. Anything richer is rejected rather than guessed at, and a malformed built-in skill is a
build failure, not a silently skipped file.

Resolution works on **identifiers only** — skill bodies are read when something asks for them, so
`agentyx resolve` never pays for the instruction text. Skills are resolved in stack order, then
declaration order, de-duplicated by first occurrence.

## MCP Servers

An **MCP server** is also authored once, without Codex or Claude fields attached. The initial model
is deliberately small: `stdio` servers have `command`, `args`, and environment variable references;
`http` servers have a `url` and optional header environment variable references. Agentyx carries
environment variable names, never committed secret values.

Stack MCP membership has an importance level: `essential`, `recommended`, or `optional`. A plain
string reference is normalized to `recommended` for compatibility. MCP definitions may also carry a
qualitative `contextCost` of `low`, `medium`, or `high`; this describes rough schema/context
overhead for inspection and future recommendations, not measured billing tokens.

Built-ins are intentionally limited to two examples:

- `context7` — remote HTTP at `https://mcp.context7.com/mcp`
- `playwright` — stdio via `npx @playwright/mcp@latest`

List them:

```sh
pnpm --silent agentyx mcp list
```

Show provider-independent data:

```sh
pnpm --silent agentyx mcp show context7
pnpm --silent agentyx mcp show context7 --json
```

## Requirements

- Node.js >=22
- pnpm 10.30.1 (`corepack enable`)

## Repository Setup

```sh
pnpm install
pnpm build
```

## `.agentyx.json`

A project describes itself with `.agentyx.json` in its root directory:

```json
{
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

Profiles are provider-neutral optimization policies:

| Profile      | Effective MCP levels                         |
| ------------ | -------------------------------------------- |
| `lean`       | `essential`                                  |
| `balanced`   | `essential`, `recommended`                   |
| `autonomous` | `essential`, `recommended`, `optional`       |

All resolved Skills remain available in every profile. Profiles only filter currently expensive
external capabilities such as MCP.

Parent directories are not searched, and an invalid configuration is reported rather than repaired.
A working example lives in [examples/angular/.agentyx.json](examples/angular/.agentyx.json) — it is a
configuration fixture, not an Angular project.

Create one for an existing project:

```sh
agentyx init
```

Non-interactive mode is deterministic and never chooses providers silently:

```sh
agentyx init --stack typescript --profile lean --target codex --yes
```

If `.agentyx.json` already exists, init refuses to replace it unless `--force` is supplied.

## `agentyx doctor`

`doctor` inspects the current project without writing files, contacting providers, starting MCP
servers, or scanning the whole filesystem:

```sh
agentyx doctor
agentyx doctor --json
```

It reports project detection, package-manager ambiguity, `.agentyx.json` validity, configured and
resolved stacks, Skill and MCP counts, target adapters, expected Skill and MCP destinations,
installability, and profile-filtered MCP. Errors such as invalid configuration or unknown targets
exit non-zero; warnings do not.

## `agentyx resolve`

Resolve a stack without needing a project configuration:

```sh
pnpm agentyx resolve angular
```

```
Profile
  balanced

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
  context7    recommended
```

Resolve the current project's `.agentyx.json`:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs resolve
```

```
Agentyx configuration

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
  context7    recommended
```

Override the profile for one invocation without editing `.agentyx.json`:

```sh
pnpm agentyx resolve angular --profile lean
```

```
Profile
  lean

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
  context7    skipped (recommended)
```

Add `--json` for machine-readable output. Use `pnpm --silent` so pnpm's own banner stays out of
stdout:

```sh
pnpm --silent agentyx resolve angular --json
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
  "declaredMcpServers": [{ "name": "context7", "level": "recommended" }],
  "mcpServers": ["context7"],
  "profile": "balanced"
}
```

`declaredMcpServers` shows what the stacks know about; `mcpServers` is the effective set for the
selected profile. `resolve` prints skill and MCP identifiers, never skill contents or provider
config, so its output stays cheap to hand to an agent.

An explicit stack argument takes precedence over `.agentyx.json` for stack selection. Unknown stacks,
unknown skills, circular inheritance, a missing file, malformed JSON, and schema violations all
print a readable message on stderr and exit with code 1.

## `agentyx skill`

List the built-in skills:

```sh
pnpm --silent agentyx skill list
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
pnpm --silent agentyx skill show angular-modern
```

```
angular-modern
Modern Angular conventions - standalone, signals, inject(), OnPush, zoneless.

# Modern Angular
...
```

`--json` gives the same skill as a `{ name, description, content }` document:

```sh
pnpm --silent agentyx skill show angular-modern --json
```

An unknown skill prints a readable message on stderr and exits with code 1.

## `agentyx profile`

List optimization profiles:

```sh
pnpm --silent agentyx profile list
```

```
lean
balanced
autonomous
```

Inspect one:

```sh
pnpm --silent agentyx profile show lean
pnpm --silent agentyx profile show lean --json
```

## `agentyx target`

A **target** is a coding agent Agentyx can install into. List them:

```sh
pnpm --silent agentyx target list
```

```
codex
claude
kimi
```

`agentyx target show <target>` adds the provider name and where it installs skills in the current
project:

```sh
pnpm --silent agentyx target show codex
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
Agentyx never writes to `$HOME`.

Codex MCP is TOML, so Agentyx parses and rewrites the file with a TOML library. Unrelated values and
MCP servers are preserved semantically, but comments and exact formatting may be normalized. Claude
and Kimi MCP are JSON, so Agentyx parses, merges, and serializes deterministically. Kimi supports SSE
too, but Agentyx's provider-neutral MCP model currently installs only `stdio` and HTTP definitions.

## `agentyx install`

`install` resolves the project, turns the resolved skills into a plan per target, and writes it.
Always look first:

```sh
cd examples/angular
node ../../packages/cli/dist/index.mjs install --dry-run
```

```
Agentyx install (dry run)

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
agentyx install
```

```
Installed: 12 written, 0 unchanged.
```

Every skill and MCP server is installed from one source. `@agentyx/core` renders the canonical
`SKILL.md` once and exposes one provider-independent MCP definition; adapters only decide where and
how each provider expects it. Re-running reports `unchanged` and writes nothing; editing a managed
entry makes the next run report `update` and restore it.

Install into a specific agent, whatever `.agentyx.json` says — `--target` is repeatable, applies to
that run only, and never edits the configuration:

```sh
agentyx install --target codex
agentyx install --target codex --target claude --target kimi
```

A stack can be named directly, exactly as with `resolve`, which installs without a `.agentyx.json` at
all. The configuration is then not read, so the target has to be explicit:

```sh
agentyx install angular --target codex --dry-run
```

For manual selection, skip stacks entirely and choose the built-in skills and MCP servers yourself:

```sh
agentyx install --select
agentyx install --target codex --skill planning --skill verification --mcp context7 --dry-run
```

Manual selection is a one-run install path; it does not rewrite `.agentyx.json`.

For inspection or focused rollout, `--skills-only` skips MCP configuration and `--mcp-only` skips
skill files. `--profile lean`, `--profile balanced`, and `--profile autonomous` override the
configured profile for that run only. Install consumes the effective MCP set, so for Angular
`--profile lean` installs the skills but skips the recommended `context7` MCP server.

`--json` prints the plan and nothing else — identifiers, statuses and project-relative paths, never
skill bodies:

```sh
pnpm --silent agentyx install core --target codex --json --dry-run
```

```json
{
  "dryRun": true,
  "profile": "balanced",
  "stacks": ["core"],
  "skills": ["planning", "systematic-debugging", "verification"],
  "declaredMcpServers": [],
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

Agentyx only manages `<destination>/<skill>/SKILL.md` for skills it resolved and MCP entries it
resolved. Other skills, provider settings, and unrelated MCP servers are preserved; a plan that
would write outside the project is refused, and nothing is ever deleted. This is why this repository
can dogfood a root `.agentyx.json` while keeping hand-authored repository-development Skills under
`.agents/skills`: Agentyx may share the directory, but it only writes exact resolved Skill
directories. A target with no adapter, or an installation with no target at all, prints a readable
message on stderr and exits with code 1.

## Library use

```ts
import {
  builtInSkillRegistry,
  builtInMcpServerRegistry,
  builtInStacks,
  loadAgentyxConfig,
  resolveAgentyxConfig,
  resolveStacks,
  resolveStackSkills,
  resolveStackMcpServers,
} from "@agentyx/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveStackSkills(["angular"]);
// ["planning", "systematic-debugging", "verification", "typescript-modern", "angular-modern"]

resolveStackMcpServers(["angular"]);
// ["context7"]

resolveAgentyxConfig(await loadAgentyxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, skills, declaredMcpServers, mcpServers, profile, targets }

builtInSkillRegistry.names; // identifiers, no file is read
builtInSkillRegistry.get("planning"); // { name, description, content }
builtInMcpServerRegistry.get("context7"); // { name, description, transport, contextCost, url }
```

`createSkillRegistry(sources)` builds an independent registry from `{ name, load }` sources, which
is the seam an external registry would use later.

Installation lives in `@agentyx/adapters`, and planning is always separate from writing:

```ts
import { applyInstallPlans, builtInAdapterRegistry, planInstall } from "@agentyx/adapters";
import { builtInMcpServerRegistry, builtInSkillRegistry } from "@agentyx/core";

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
`AgentyxConfigNotFoundError`, `AgentyxConfigParseError`, `AgentyxConfigValidationError`,
`UnknownAdapterError`, `DuplicateAdapterError`, `MissingInstallTargetsError`, `InstallPathError`,
`ProviderConfigParseError` — all extending `AgentyxError` with a stable `code`.

## Packages

| Package                                     | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`@agentyx/core`](packages/core)               | Configuration model, stacks, skills, MCP, resolution, JSON Schema |
| [`@agentyx/cli`](packages/cli)                 | The `agentyx` command-line interface                         |
| [`@agentyx/adapters`](packages/adapters)       | Adapter contract, Codex, Claude Code and Kimi Code adapters, MCP rendering, install planning |

## Not implemented yet

Agentyx installs skills and profile-filtered MCP configuration into Codex, Claude Code and Kimi Code,
project-locally, and nothing more. Still to come: further providers such as OpenCode and Cursor,
global installation into `$HOME`, remote and community registries, richer optimization advice,
uninstall and sync cleanup, a plugin system, codebase memory, npm registry integration, and an
update system.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and the architecture rules that
keep Agentyx provider agnostic. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), never
a public issue.

```sh
pnpm check   # biome + typecheck + test + build
```

## License

[MIT](LICENSE) © Andersseen
