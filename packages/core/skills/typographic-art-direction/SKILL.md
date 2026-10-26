---
name: typographic-art-direction
description: Treat type as visual identity for web pages, covering display and reading roles, scale contrast, measure, rhythm and deliberate line breaks.
---

# Typographic art direction

Use this when a site's character depends on type. Typography is identity, not just a set of utility
classes. System fonts used with discipline are a valid answer; add a typeface only when it earns its
cost.

## Assign roles

Separate display, reading, interface labels and data. Give each role a clear job and keep the number
of families, weights and sizes small. Two clearly different voices usually beat three similar ones.

## Make contrast do the work

- Use a bold jump in scale between display and body rather than many near-identical steps.
- Let weight, case and width vary sparingly; each change should signal a different kind of content.
- Use monospace only where the text is literally code, a path, a command or tabular data, never as a
  generic technical flavor.
- Use tabular numerals for aligned figures and numbers that change.

## Shape the text block

Treat headings and paragraphs as shapes on the page. Choose alignment on purpose, set a comfortable
measure for reading text, and tune line-height per role: tight for large display, looser for body.
Break display lines where the meaning breaks, using balanced wrapping or explicit breaks that still
reflow at small sizes. Avoid orphans and single-word last lines in headlines.

## Responsive behavior

Scale display type fluidly with sensible lower and upper bounds. Verify the longest real headline at
the narrowest supported width: no clipped words, no horizontal overflow, no collapse into body size.

## Fonts and constraints

Follow the project's conventions. Do not add remote font requests casually: weigh licensing, privacy,
layout shift and load cost. If a font is justified, self-host a minimal subset with a metric-matched
fallback. Respect user font-size settings by using relative units.

## Stop condition

Stop when a reader can identify the product's voice from type alone, the hierarchy holds with color
removed, and reading text stays comfortable.
