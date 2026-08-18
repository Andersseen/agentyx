# @agentyx/adapters

Provider adapters for [Agentyx](https://github.com/Andersseen/agentyx): the layer that turns an
already-resolved Agentyx environment into the files a specific coding agent expects.

Agentyx packs, skills, MCP definitions, and tool checks describe development environments, never
providers, so everything a provider knows lives here rather than in
[`@agentyx/core`](https://github.com/Andersseen/agentyx/tree/main/packages/core). This package depends
on core; core never depends on it.

## Targets

| Id       | Agent       | Project skill destination |
| -------- | ----------- | ------------------------- |
| `codex`  | Codex       | `.agents/skills`          |
| `claude` | Claude Code | `.claude/skills`          |
| `kimi`   | Kimi Code   | `.agents/skills`          |

Both destinations are the providers' documented project-local conventions:
[Codex](https://developers.openai.com/codex/skills) reads repository skills from the vendor-neutral
`.agents/skills`, [Claude Code](https://code.claude.com/docs/en/skills) from `.claude/skills`, and
[Kimi Code](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html) also scans
project `.agents/skills`.
Installation is project-local — nothing is written to `$HOME`.

## Plan first, then write

```ts
import { applyInstallPlans, planInstall } from "@agentyx/adapters";
import { builtInSkillRegistry } from "@agentyx/core";

const skills = ["planning", "angular-modern"].map((name) => builtInSkillRegistry.get(name));

// Reads the destinations to classify each file, and writes nothing.
const plans = await planInstall({ targets: ["codex", "claude", "kimi"], projectDir, skills });

// The only code in Agentyx that mutates a project. Skipping it is a dry run.
await applyInstallPlans(plans);
```

A plan is a list of `write-file` operations, each with a `create` / `update` / `unchanged` status, an
absolute path and the project-relative path used for output. Parent directories are created by the
executor, so there is no directory operation; there is no operation that runs a command.

Every target is handed the same `SkillDefinition` objects and the canonical `SKILL.md` that
`@agentyx/core` renders, so providers can only ever receive identical instructions. Providers that
share the same destination and content, such as Codex and Kimi Code, collapse to one physical write
with shared `usedBy` metadata.

## Writing an adapter

An adapter is a plain object satisfying `AgentAdapter`: an `id`, a `name`, the directory it owns,
`detect`, and a **pure** `planFiles` that maps resolved skills to desired files. Comparing them with
what is installed and writing them is shared machinery.

```ts
import { createAdapterRegistry, createSkillDirectoryAdapter } from "@agentyx/adapters";

const acme = createSkillDirectoryAdapter({
  id: "acme",
  name: "Acme Agent",
  skillsDir: [".acme", "skills"],
  reference: "https://example.invalid/skills",
});

const registry = createAdapterRegistry([acme]);
```

`createSkillDirectoryAdapter` covers any agent that reads `<directory>/<skill>/SKILL.md`; a genuinely
different layout implements `AgentAdapter` directly. There is no dynamic package loading and no
remote registry — an adapter is a value you pass in.

## Safety

Agentyx only manages `<destination>/<skill>/SKILL.md` for skills it resolved, plus the MCP server keys
it added to a provider project config. A plan that would write outside the directory or project file a
target owns is refused with `InstallPathError`, including project-local paths redirected through
symlinks. Unchanged files are not rewritten, writes are UTF-8, and nothing is executed, fetched, or
installed globally.

Project MCP configuration is planned and written through the same plan-first machinery. Adapters
receive only active MCP definitions; pack and optional-capability resolution stays in core. Hooks,
permissions and user-global configuration are not part of the contract yet.

Prune and uninstall act only on paths and MCP server keys recorded in `.agentyx.lock.json`. A file
whose current content no longer matches the manifest hash is reported as a conflict and left alone
unless the caller explicitly chooses `--force`.

MIT © Andersseen
