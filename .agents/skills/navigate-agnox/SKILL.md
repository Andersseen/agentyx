---
name: navigate-agnox
description: Navigate the Agnox repository by package responsibility so changes start in the right place.
---

# Navigate Agnox

Use this skill when deciding where an Agnox change belongs. It is a repository-development skill,
not a built-in Agnox product skill.

## Conceptual Map

`packages/core` owns provider-neutral domain models, schemas, registries, resolvers, domain errors,
SKILL.md parsing and serialization, and built-in product Skill assets.

`packages/adapters` owns provider translation: target adapters, destination paths, install plans,
safe file writes, and provider-specific MCP config rendering. It depends on core definitions but
does not define stacks, skills or MCP servers.

`packages/cli` owns Commander wiring and terminal/JSON output. CLI tests call command functions and
assert returned strings; do not spawn the binary in unit tests.

`packages/core/skills` contains built-in product Skills that Agnox can install into user projects.
Each skill is data: a directory with `SKILL.md`, loaded by the core registry.

`.agents/skills` contains Skills for developing this repository. These are not Agnox product
configuration unless explicitly promoted later.

`examples` contains fixtures used across core, adapters and CLI tests.

## Where To Start

Changing a domain schema, resolver, registry or error -> `packages/core`.

Adding or changing a provider target -> `packages/adapters`.

Adding a CLI command, flag or output shape -> `packages/cli`.

Changing a built-in installed Skill -> `packages/core/skills`.

Changing how agents develop Agnox -> `.agents/skills` and, only if always-loaded context needs to
change, `AGENTS.md`.
