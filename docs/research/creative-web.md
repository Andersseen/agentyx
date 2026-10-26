# creative-web research and website dogfooding

Starting point: `main` at `a1e2690f017a714407425f695a42a92ece5e20de`, `@agentyx/*` 0.23.0, no
pending feature Changesets.

## Responsibility split

| Pack | Question it answers |
| --- | --- |
| `ui-ux` | Does the *product interface* behave well: usability, states, interaction, design-system consistency, product copy, rendered verification. |
| `creative-web` | What should an *expressive website* feel like: concept, composition, type, storytelling, motion, critique. |

`creative-web` reuses `design-system-practice` and `visual-verification` from `ui-ux` instead of
copying them. Pack relationships stay declarative: no inheritance, no hidden dependency, and a shared
Skill resolves once with both origins. Project detection never recommends `creative-web`; framework
or CSS tooling does not imply expressive marketing design.

## Public references studied

Inspected 2026-10-26, as research references only:

- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  (frontmatter points to a separate `LICENSE.txt`, so its wording is not reused).
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) (the
  fetched file states no license).

Adopted ideas, all rewritten independently:

- plan a direction before building and review it against the brief (→ `creative-direction`);
- ground choices in the subject's own world instead of genre defaults (→ product vocabulary step);
- structural devices (numbering, labels, borders) only when they carry information (→
  `design-critique`);
- one orchestrated motion moment instead of reveals everywhere (→ `motion-art-direction`);
- critique afterwards and strip decoration that serves nothing (→ `design-critique`).

Deliberately not adopted:

- fixed palette recipes, "banned look" lists and ASCII wireframe deliverables, which would turn
  guidance into a style template;
- the Vercel rule catalogue (forms, i18n, hydration, focus rings, images, `transition: all`). Those
  are correctness and performance concerns owned by `ui-ux`, `accessibility` and `performance`;
- Title Case and other copy conventions, which belong to a project's own voice.

No upstream Skill text, asset or checklist was vendored. Neither source was added to the
trusted-source registry.

## design-reference-research: included

It earns its own Skill because "research by concept, not by category" changes what an agent
searches for and what it extracts (principles, not layouts). It is written to be fully useful
offline: it falls back to repository material and reasoning, and requires saying which references
came from research. `creative-web` never depends on browsing.

## Semantic evaluation

`evals/skill-behavior.json` gained six scenarios (positive redesign, visual explanation, motion,
reference grounding, creative page with an existing design system, and an admin-form negative
control). `excludedSkills` is a new optional field: the control asserts that a product-form prompt
with `ui-ux` receives none of the creative Skills. These scenarios validate pack and Skill
responsibility only. They do not show that the guidance produces better design.

## Official website: creative direction

Inspected first: home, packs, providers and a docs article in light and dark at 1440 and 390 px.
The old site was technically solid but generic: radial-gradient backdrop, grid background, pill
eyebrow, centered-feeling hero with a glowing config card, numbered uppercase section eyebrows,
repeated Card sections with identical widths and fade-up/hover-lift on every block.

Concepts considered:

1. **Patchbay / routing board**: one definition cabled into native provider destinations.
2. **Harness blueprint**: drafting language (hairlines, title block, callouts) for capability
   composition and ownership.
3. **Control plane**: a dense operator surface centered on Doctor state.
4. **Capability topology**: packs as the visual structure of the site.

Chosen: **patchbay + blueprint**, because it is the product's real model (resolve, route, own) and
needs only real data: paths from `data/providers.ts`, counts from `data/site.ts`, the `resolve`
result of a real composition. Control plane survives, scoped to the Doctor readout. Topology was
rejected: it would require a graph that implies capabilities Agentyx does not model.

Visual grammar: hairline `--wire` lines, corner-ticked "sheets", mono only for literal paths,
commands and measured values, one heavy tight display style, system fonts only (no remote or
self-hosted font was added), brand indigo kept. Motion language: lines draw in causal order
(definition → resolver → bus → destinations → lockfile) once, CSS-only, with the finished diagram
as the base state; the Doctor readout rows settle in once with Angular Movement. Reduced motion
removes the animation entirely.

Narrative: one definition (hero board) → capabilities resolve (design pair, shared provenance) →
lifecycle rail → provider matrix → Doctor readout → packs compose (one inverted full-bleed band).
`/packs` now leads with purpose and the `ui-ux` vs `creative-web` distinction before the catalogue;
`/providers` keeps both matrices unchanged in content; docs keep Doqs, the reading column, TOC and
navigation, inheriting only tokens, header and footer.

## design-critique pass

Run once after the first rendered review, then one confirmation pass.

Findings fixed:

- the global unlayered `a { color: inherit }` overrode utility colors on links (invisible button
  text on the inverted band, grey in-copy links): moved to the base layer;
- the workflow rail collided with its heading because a component `margin: 0` beat the utility;
- the `heading left / lede right` split repeated on four consecutive sections: providers now stacks
  its heading and lede;
- hero content did not align with the navbar container, and the hero board overflowed the first
  viewport: aligned containers, compacted the config and rows;
- caption contrast on the inverted band was too low;
- scrollable code regions were not keyboard reachable: added `tabindex="0"`.

Kept on purpose: the corner ticks and dashed ledger rule (they belong to the drafting concept and
mark the lockfile boundary), mono labels (every one is a path, command or measured value), and the
inverted closing band (the page's single full-bleed moment).

## Honesty notes

This is a qualitative adoption case. It does not show that `creative-web` produces better design,
and the semantic evaluation does not either. A comparative behavioral evaluation can come later.
R100 provider validation remains on standby and is not completed by this minor.
