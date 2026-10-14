---
name: visual-verification
description: Run a bounded rendered-interface review when browser inspection is available, with honest static fallback.
---

# Visual verification

Verify the complete scoped change, not an isolated hero screenshot. First understand the intended
task, states and responsive behavior; then implement the change before reviewing it.

When a safe local app and browser inspection are available, use one bounded cycle:

1. inspect the relevant desktop and mobile views together;
2. check the feature's meaningful states, such as long content, empty, loading, error and focus;
3. note visual hierarchy, clipping, overflow, alignment, density, copy and interaction defects;
4. fix the defects in one batch;
5. perform at most one confirmation pass, then stop.

Add dark/light or hover checks only when the project supports them and the feature uses them. Choose
viewports that expose the feature rather than collecting screenshots for their own sake. Do not spend
an open-ended loop on tiny visual edits.

If browser tooling or a runnable app is unavailable, inspect source, tokens, layout constraints and
state coverage instead. Report exactly: `Rendered verification not performed.` Never imply that a
screenshot, viewport or interaction was checked when it was not.
