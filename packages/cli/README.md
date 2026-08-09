# @agentyx/cli

The `agentyx` command-line interface for
[Agentyx](https://github.com/Andersseen/agentyx), provider-agnostic tooling for coding-agent
environments.

```sh
agentyx resolve angular
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

Run without arguments to resolve the `.agentyx.json` in the current directory, and add `--json` for
machine-readable output:

```sh
agentyx resolve
agentyx resolve --json
agentyx resolve angular --profile lean
```

An explicit stack argument takes precedence over `.agentyx.json` for stack selection. `resolve` prints
skill identifiers only; `agentyx skill` is what reads instructions. MCP output shows declared
capabilities and whether the selected profile made them effective:

```sh
agentyx skill list
agentyx skill show angular-modern
agentyx skill show angular-modern --json
```

Use `agentyx profile list` and `agentyx profile show lean` to inspect the built-in optimization
profiles.

`agentyx install` writes the resolved skills into each target agent — `codex` and `kimi` install into
`.agents/skills`, `claude` into `.claude/skills`, all project-local. Plan first:

```sh
agentyx install --dry-run
agentyx install --dry-run --json
agentyx install
agentyx install --target codex
agentyx install --target kimi
agentyx install angular --target codex
agentyx install --profile lean
```

`--target` is repeatable and overrides `.agentyx.json` for that run without editing it. Re-running an
up-to-date project reports `unchanged` and writes nothing. `--profile` also applies only to that
run; install receives the effective MCP set from core, while adapters stay unaware of optimization
profiles. `agentyx target list` and `agentyx target show <target>` show what can be installed into and
where.

Errors print a readable message on stderr and exit with code 1.

All resolution logic lives in
[`@agentyx/core`](https://github.com/Andersseen/agentyx/tree/main/packages/core); this package only adds
the command surface and terminal output.

See the [main README](https://github.com/Andersseen/agentyx#readme) for the configuration format.

MIT © Andersseen
