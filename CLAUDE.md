# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- `.claude/settings.json` allowlists the read-only and build commands used here, and auto-runs
  `biome check --write` on files you edit. Personal overrides go in `.claude/settings.local.json`,
  which is gitignored.
- The project's workflow skills live in [.agents/skills](.agents/skills), shared with every other
  agent. `.claude/skills/<name>/SKILL.md` is only a bridge that exposes them as slash commands, so
  edit the file under `.agents/skills` and leave the bridge alone:
  - `/verify-agnox` — the full verification pipeline, including the CLI checks `pnpm check` does not
    cover.
  - `/add-builtin-stack` — add a stack to the built-in registry with the tests it needs.
- Prefer editing source and running `pnpm test` (which aliases `@agnox/core` to source) over
  rebuilding. The only work that needs a build is the CLI binary and the JSON Schema generator.
