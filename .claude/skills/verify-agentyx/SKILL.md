---
name: verify-agentyx
description: Run the full Agentyx verification pipeline before handing work back - formatting, typecheck, tests, build, and the CLI behaviour checks that pnpm check does not cover. Use after any change to packages/core, packages/cli, or the config schema.
---

# Verify an Agentyx change

The instructions for this skill are provider-neutral and live in one place, shared by every agent
that works on this repository:

**[.agents/skills/verify-agentyx/SKILL.md](../../../.agents/skills/verify-agentyx/SKILL.md)**

Read that file now and follow it. This file is only the bridge that makes the skill discoverable as
`/verify-agentyx` in Claude Code — never copy the instructions here, and never let the two drift.
