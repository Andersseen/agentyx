---
name: official-website-development
description: Build the official Agentyx website with token-frugal discovery, grounded product copy, and visual verification.
---

# Official Website Development

Use this skill when designing or implementing the official Agentyx website. The goal is to ship the
actual site experience while avoiding broad repo dumps and repeated context-heavy exploration.

## Product Grounding

Ground copy and structure in local source material:

- `README.md` for current positioning and commands.
- `packages/core/README.md`, `packages/cli/README.md`, and `packages/adapters/README.md` for package
  responsibilities.
- `.agentyx.json` for how this repository dogfoods Agentyx.
- Changelogs only when release history matters.

Read only the sections needed for the current page. Do not invent product claims that the CLI cannot
currently support.

## Page Scope

Prefer one usable official site over a marketing sketch. A good first version should include:

- What Agentyx is.
- The pack-first configuration example.
- Supported targets.
- A short CLI flow from init to install or resolve.
- Why provider-neutral Skills and MCP definitions matter.

Keep future roadmap items visually separate from shipped capabilities.

## Token-Frugal Workflow

Before editing, identify the website app or create the smallest local site structure that matches
the repository. Use targeted file reads and small diffs. Avoid loading every package source just to
write page copy.

When running commands, use RTK if available for noisy builds, tests, and diffs. For exact visual or
runtime failures, keep raw output around the failing line.

## Visual Verification

Run the local site and verify with screenshots or browser inspection on desktop and mobile. Check
for blank screens, clipped text, overlapping content, unreadable contrast, broken links, and commands
that drift from the current README.

Do not call the work done until the page is usable from the first viewport and the primary commands
shown on the page match the built CLI or documented workflow.

## Handoff

Report the site entry point, the commands run, the visual checks performed, and any content that is
intentionally deferred. Keep the report short.
