# Trusted third-party sources

Popular does not automatically mean safe to install. Agentyx should make reputable Skill and plugin
collections easier to use without turning `install` into an unaudited remote-code runner.

## Integration classes

### Instruction-only Skill collections

A collection whose Skills are fully represented by `SKILL.md` can be pinned or vendored inside the
project and declared through `skillDirectories` and `localPacks`. Agentyx validates and installs the
canonical Markdown but performs no network access.

### Resource-bearing Skills

The Agent Skills specification also permits `scripts/`, `references/`, `assets/`, optional metadata,
and tool declarations. Agentyx does not copy or execute these resources yet. A future source feature
must preserve every referenced file, hash the complete tree, declare executable content, and make
the proposed files visible in a dry run.

### Provider plugins and workflow frameworks

Projects such as [Superpowers](https://github.com/obra/superpowers) include more than standalone
Skills: provider manifests, hooks, supporting files, and lifecycle behavior. Agentyx should prefer
the provider's native plugin mechanism when one exists instead of flattening the project into local
Skills. The Agentyx integration can pin compatibility, report installation health, and link the
native installation path without pretending to own files written by another installer.

## Current Superpowers integration

Agentyx knows `superpowers` as a trusted `codex-plugin` source. A project can vendor or submodule a
reviewed checkout and pin the reviewed ref:

```json
{
  "trustedSources": [
    {
      "name": "superpowers",
      "path": ".agentyx/sources/superpowers",
      "ref": "v5.1.0"
    }
  ]
}
```

`agentyx source inspect superpowers` validates:

- the checkout resolves inside the project;
- `.codex-plugin/plugin.json` is readable JSON;
- the manifest name is `superpowers`;
- the manifest repository is `https://github.com/obra/superpowers`;
- the manifest points to a Skill directory inside the checkout;
- every listed Skill has a matching lowercase kebab-case `SKILL.md` name;
- which Skills carry supporting files that Agentyx does not install yet.

The command is intentionally local-only. It does not clone, fetch, execute plugin hooks, copy assets,
or install Skills. Once Agentyx manages complete Skill directories, this same source record can
become the compatibility gate for installing selected Superpowers Skills.

## Admission policy

A curated source is eligible only when all of these are recorded:

- canonical repository and maintainer;
- immutable commit or signed release tag;
- license for every distributed file;
- expected Skill/plugin layout;
- scripts, hooks, binaries, network access, and telemetry;
- supported Agentyx targets;
- content-tree hash and last review date;
- an explicit update diff reviewed before changing the pin.

Sources must never default to a moving branch such as `main`, run lifecycle scripts during import,
or receive credentials from Agentyx. Revoked or compromised sources remain pinned and produce a
doctor diagnostic until the user deliberately updates or removes them.

## Initial candidates

- [obra/superpowers](https://github.com/obra/superpowers): provider-native workflow framework; treat
  as a plugin integration, not a plain Skill copy.
- [agentskills/skills](https://github.com/agentskills/skills): reference collection associated with
  the open Agent Skills format; review licensing and resources per Skill.
- [anthropics/skills](https://github.com/anthropics/skills): established collection with substantial
  resource-bearing Skills; verify each Skill's license and compatibility.
- [github/awesome-copilot](https://github.com/github/awesome-copilot): community collection useful
  for discovery; curate individual entries instead of trusting the complete repository transitively.
