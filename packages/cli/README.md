# @agnox/cli

The `agnox` command-line interface for
[Agnox](https://github.com/Andersseen/agnox), provider-agnostic tooling for coding-agent
environments.

```sh
agnox resolve angular
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
```

Run without arguments to resolve the `.agnox.json` in the current directory, and add `--json` for
machine-readable output:

```sh
agnox resolve
agnox resolve --json
```

An explicit stack argument takes precedence over `.agnox.json` for stack selection. `resolve` prints
skill identifiers only; `agnox skill` is what reads instructions:

```sh
agnox skill list
agnox skill show angular-modern
agnox skill show angular-modern --json
```

`agnox install` writes the resolved skills into each target agent — `codex` installs into
`.agents/skills`, `claude` into `.claude/skills`, both project-local. Plan first:

```sh
agnox install --dry-run
agnox install --dry-run --json
agnox install
agnox install --target codex
agnox install angular --target codex
```

`--target` is repeatable and overrides `.agnox.json` for that run without editing it. Re-running an
up-to-date project reports `unchanged` and writes nothing. `agnox target list` and
`agnox target show <target>` show what can be installed into and where.

Errors print a readable message on stderr and exit with code 1.

All resolution logic lives in
[`@agnox/core`](https://github.com/Andersseen/agnox/tree/main/packages/core); this package only adds
the command surface and terminal output.

See the [main README](https://github.com/Andersseen/agnox#readme) for the configuration format.

MIT © Andersseen
