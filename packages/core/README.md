# @agnox/core

Domain foundations for [Agnox](https://github.com/Andersseen/agnox): the `.agnox.json` configuration
model, stack definitions, built-in stack/skill/MCP registries, optimization profiles, and
resolution.

This package has no dependency on Commander or any terminal UI — CLI concerns live in
[`@agnox/cli`](https://github.com/Andersseen/agnox/tree/main/packages/cli).

```ts
import {
  builtInSkillRegistry,
  builtInStacks,
  loadAgnoxConfig,
  resolveAgnoxConfig,
  resolveStackMcpServerReferences,
  resolveStacks,
  resolveStackSkills,
} from "@agnox/core";

resolveStacks(["angular"]);
// ["core", "typescript", "angular"]

resolveStackSkills(["angular"]);
// ["planning", "systematic-debugging", "verification", "typescript-modern", "angular-modern"]

resolveStackMcpServerReferences(["angular"]);
// [{ name: "context7", level: "recommended" }]

resolveAgnoxConfig(await loadAgnoxConfig(process.cwd()));
// { requestedStacks, resolvedStacks, skills, declaredMcpServers, mcpServers, profile, targets }
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
`SKILL.md`, and `formatSkillMarkdown(skill)` renders one deterministically. That serializer is the
canonical form every provider installs, which is why it lives here: an adapter decides where a skill
goes, never what it says.

MCP resolution keeps both declared and effective capabilities visible. Profiles are provider-neutral:
`lean` enables essential MCP only, `balanced` enables essential and recommended MCP, and
`autonomous` enables essential, recommended and optional MCP. Skill identifiers are not filtered by
profile.

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

Installing skills and effective MCP capabilities into an agent is
[`@agnox/adapters`](https://github.com/Andersseen/agnox/tree/main/packages/adapters); core knows
nothing about providers. See the [main README](https://github.com/Andersseen/agnox#readme) for the
full picture.

MIT © Andersseen
