# Agentyx

Agentyx is a provider-agnostic CLI for giving coding agents the same project-local development
behavior across Codex, Claude Code, and Kimi Code.

You choose composable capability **packs**:

```json
{
  "packs": ["technical", "typescript", "angular", "efficiency", "agentic"],
  "enable": ["rtk"],
  "targets": ["codex", "kimi"]
}
```

Packs contribute provider-neutral capabilities:

- **Skills**: installed as native `SKILL.md` files, so agents load relevant instructions on demand.
- **MCP servers**: configured only when selected and active.
- **Local tools**: detected and reported by doctor; Agentyx does not auto-install executables.

## Packs

| Pack         | Category    | Purpose                                                        |
| ------------ | ----------- | -------------------------------------------------------------- |
| `technical`  | engineering | General engineering quality, API design, code review           |
| `typescript` | language    | Strict, modeled, modern TypeScript                             |
| `angular`    | framework   | Modern Angular APIs, signals, architecture, testing            |
| `efficiency` | efficiency  | Context-efficient exploration, output, iteration, verification |
| `agentic`    | workflow    | Brainstorming, planning, debugging, parallel and review flows  |

Technology packs do not hide inheritance. If a project wants both TypeScript and Angular behavior,
select both:

```json
{
  "packs": ["technical", "typescript", "angular"],
  "targets": ["codex", "claude"]
}
```

## Optional Capabilities

Some capabilities are useful but heavier. They are declared by packs but disabled until explicitly
enabled:

```json
{
  "packs": ["efficiency"],
  "enable": ["rtk", "codebase-memory"],
  "targets": ["codex"]
}
```

Current optional capabilities:

- `rtk`: Rust Token Killer executable, detected as `rtk` on PATH.
- `codebase-memory`: structural code-intelligence MCP backed by a persistent knowledge graph.

Agentyx never downloads binaries, runs installers, edits PATH, or installs third-party runtime
Skills for these capabilities.

## Usage

Initialize a project:

```sh
pnpm agentyx init \
  --pack technical \
  --pack typescript \
  --pack angular \
  --target codex \
  --target kimi \
  --yes
```

Inspect packs:

```sh
pnpm agentyx pack list
pnpm agentyx pack show efficiency
```

Resolve the selected capabilities:

```sh
pnpm agentyx resolve
pnpm agentyx resolve technical typescript angular
pnpm agentyx resolve efficiency --enable rtk --json
```

Install into configured targets:

```sh
pnpm agentyx install --dry-run
pnpm agentyx install
```

Inspect project health:

```sh
pnpm agentyx doctor
pnpm agentyx doctor --json
```

## Configuration

`.agentyx.json` fields:

| Field     | Type       | Default | Meaning                                      |
| --------- | ---------- | ------- | -------------------------------------------- |
| `$schema` | `string`   | none    | Optional JSON Schema path or URL             |
| `packs`   | `string[]` | `[]`    | Capability packs selected for the project    |
| `enable`  | `string[]` | `[]`    | Optional capabilities activated explicitly   |
| `targets` | `string[]` | `[]`    | Coding-agent providers to install into       |

Unknown packs and unknown enabled capabilities fail with explicit Agentyx errors.

## Architecture

The product boundary is:

```text
packs
  -> provider-neutral capabilities
  -> adapters
```

Adapters do not know about packs. They receive already-resolved Skills and MCP definitions and write
provider-specific project files. Agentyx keeps installation planning separate from filesystem
writes, and it only writes managed Skill files and managed MCP entries.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

Tests import core source through workspace aliases, so most unit tests do not require a build. The
CLI binary checks do require `pnpm build`.
