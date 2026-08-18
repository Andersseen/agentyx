## What does this change?

<!-- One or two sentences. Link the issue it closes, if any. -->

## Why?

<!-- The problem this solves. Skip if it is obvious from the description. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] Tests cover the new behaviour (and any bug fix has a regression test)
- [ ] `pnpm changeset` added, if a published package changed
- [ ] `@agentyx/core` still has no dependency on Commander or terminal UI
- [ ] No provider-specific concepts were added to packs, skills, or core resolution
- [ ] `packages/core/schema/agentyx.schema.json` regenerated, if the config schema changed
