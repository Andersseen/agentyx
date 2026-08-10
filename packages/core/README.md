# @agentyx/core

Domain foundations for Agentyx: `.agentyx.json` parsing, pack definitions, built-in Skill/MCP/tool
registries, project detection, JSON Schema generation, and provider-neutral resolution.

This package has no dependency on Commander or terminal UI. CLI concerns live in `@agentyx/cli`, and
provider filesystem writes live in `@agentyx/adapters`.

```ts
import {
  builtInPacks,
  loadAgentyxConfig,
  resolveAgentyxConfig,
  resolvePackSkills,
  resolvePacks,
} from "@agentyx/core";

builtInPacks.map((pack) => pack.name);
// ["technical", "typescript", "angular", "efficiency", "agentic"]

resolvePacks(["technical", "typescript", "angular"]);
// ["technical", "typescript", "angular"]

resolvePackSkills(["typescript"]);
// ["typescript-strict", "typescript-modeling", "typescript-modern"]

resolveAgentyxConfig(await loadAgentyxConfig(process.cwd()));
// { requestedPacks, resolvedPacks, skills, declaredMcpServers, mcpServers, declaredTools, tools, enabled, targets }
```

Packs are composable capability bundles. They can contribute default Skills, default MCP servers, and
optional MCP/tool capabilities. Optional capabilities are active only when their identifier appears
in `enable`.

```json
{
  "packs": ["technical", "typescript", "efficiency"],
  "enable": ["rtk"],
  "targets": ["codex"]
}
```

Skills ship as `SKILL.md` assets under `skills/`. Resolution returns identifiers only; a Skill body
is read only when `SkillRegistry.get(name)` is called.

The JSON Schema for `.agentyx.json` ships with the package:

```json
{
  "$schema": "./node_modules/@agentyx/core/schema/agentyx.schema.json"
}
```

Resolution failures throw domain errors extending `AgentyxError`, including `UnknownPackError`,
`UnknownEnabledCapabilityError`, `UnknownSkillError`, `UnknownMcpServerError`, and
`UnknownToolError`.

MIT © Andersseen
