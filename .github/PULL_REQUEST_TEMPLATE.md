## What does this change?

<!-- One or two sentences. Link the issue it closes, if any. -->

## Why?

<!-- The problem this solves. Skip if it is obvious from the description. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] Tests cover the new behaviour (and any bug fix has a regression test)
- [ ] `pnpm changeset` added, if a published package changed
- [ ] `@agnox/core` still has no dependency on Commander or terminal UI
- [ ] No provider-specific concepts were added to the stack model
- [ ] `packages/core/schema/agnox.schema.json` regenerated, if the config schema changed
