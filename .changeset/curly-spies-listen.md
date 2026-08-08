---
"@agnox/core": minor
"@agnox/cli": minor
---

Add provider-agnostic skills. Stacks now declare a `skills` list, `resolveStackSkills()` expands it
through stack inheritance, and the resolved configuration carries the resulting skill identifiers.
`@agnox/core` ships five built-in skills as `SKILL.md` package assets — `planning`,
`systematic-debugging`, `verification`, `typescript-modern`, `angular-modern` — behind a lazy
`SkillRegistry`, so resolution stays on identifiers and never reads a skill body. The CLI gains
`agnox skill list` and `agnox skill show <name>`, and `agnox resolve` prints a `Skills` section.
