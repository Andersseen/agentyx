# @agnox/cli

The `agnox` command-line interface for
[Agnox](https://github.com/Andersseen/agnox), provider-agnostic tooling for coding-agent
environments.

```sh
agnox resolve angular
```

```
core
typescript
angular
```

Run without arguments to resolve the `.agnox.json` in the current directory, and add `--json` for
machine-readable output:

```sh
agnox resolve
agnox resolve --json
```

An explicit stack argument takes precedence over `.agnox.json` for stack selection. Errors print a
readable message on stderr and exit with code 1.

All resolution logic lives in
[`@agnox/core`](https://github.com/Andersseen/agnox/tree/main/packages/core); this package only adds
the command surface and terminal output.

See the [main README](https://github.com/Andersseen/agnox#readme) for the configuration format.

MIT © Andersseen
