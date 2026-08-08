# @agnox/core

Domain foundations for [Agnox](https://github.com/Andersseen/agnox): the `.agnox.json` configuration
model, the stack definition model, the built-in stack and skill registries, and resolution.

This package has no dependency on Commander or any terminal UI — CLI concerns live in
[`@agnox/cli`](https://github.com/Andersseen/agnox/tree/main/packages/cli).

```ts
import {
  builtInSkillRegistry,
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStacks,
  resolveStackSkills,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveStackSkills(["angular"]);
// ["planning", "systematic-debugging", "verification", "typescript-modern", "angular-modern"]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, skills, profile, targets }
```

## Skills

A skill is provider-independent instruction text: `{ name, description, content }` and nothing else.
The built-in skills ship as `SKILL.md` files under `skills/`, with YAML frontmatter for the metadata
and the Markdown body as the content, and are published alongside `dist/`.

Resolution works on identifiers, and `SkillRegistry.get(name)` is what reads a body:

```ts
builtInSkillRegistry.names; // identifiers, no file is read
builtInSkillRegistry.has("planning"); // no file is read
builtInSkillRegistry.get("planning"); // reads, validates and caches SKILL.md
```

`createSkillRegistry(sources)` builds an independent registry from `{ name, load }` sources — the
seam an external registry would use later. `parseSkillMarkdown(markdown, origin)` parses one
`SKILL.md`.

The JSON Schema for `.agnox.json` ships with the package:

```json
{
  "$schema": "./node_modules/@agnox/core/schema/agnox.schema.json"
}
```

Resolution failures throw domain errors — `UnknownStackError`, `CircularStackDependencyError`,
`UnknownSkillError`, `DuplicateSkillError`, `InvalidSkillError`, `AgnoxConfigNotFoundError`,
`AgnoxConfigParseError`, `AgnoxConfigValidationError` — all extending `AgnoxError` with a stable
`code`.

Installing skills into an agent's directory, MCP tools, agents and provider adapters are **not
implemented yet**. See the [main README](https://github.com/Andersseen/agnox#readme) for the full
picture.

MIT © Andersseen
