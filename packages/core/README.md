# @agnox/core

Domain foundations for [Agnox](https://github.com/Andersseen/agnox): the `.agnox.json` configuration
model, the stack definition model, the built-in stack registry, and stack resolution.

This package has no dependency on Commander or any terminal UI — CLI concerns live in
[`@agnox/cli`](https://github.com/Andersseen/agnox/tree/main/packages/cli).

```ts
import {
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, profile, targets }
```

The JSON Schema for `.agnox.json` ships with the package:

```json
{
  "$schema": "./node_modules/@agnox/core/schema/agnox.schema.json"
}
```

Resolution failures throw domain errors — `UnknownStackError`, `CircularStackDependencyError`,
`AgnoxConfigNotFoundError`, `AgnoxConfigParseError`, `AgnoxConfigValidationError` — all extending
`AgnoxError` with a stable `code`.

Skills, MCP tools, agents and provider adapters are **not implemented yet**; stacks currently carry
metadata only. See the [main README](https://github.com/Andersseen/agnox#readme) for the full
picture.

MIT © Andersseen
