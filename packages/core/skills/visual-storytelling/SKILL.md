---
name: visual-storytelling
description: Demonstrate product ideas visually through diagrams, real output, states and transformations instead of replacing every explanation with feature cards.
---

# Visual storytelling

Use this when a page must explain how something works. Ask: what can the page demonstrate instead of
merely claim? If an important idea can be shown, do not substitute three cards that describe it.

## Pick the form that matches the idea

- a mechanism or flow: a diagram or pipeline whose structure mirrors the real system;
- a transformation: input beside output, before and after, source turned into result;
- change over time: a timeline or sequence of states;
- a relationship or ownership: a graph, map or layered view;
- a quality claim: real product output, an annotated interface or a measured result;
- a choice: a controlled interactive comparison with a sensible default.

Prefer artifacts the product really produces, such as actual commands, files, paths and outputs,
over illustrations of them.

## Make visuals carry information

Every element should map to something true: a node is a real component, a line is a real relationship,
a label is a real name. Remove shapes that only decorate. Give the visual a readable text equivalent
and make it useful without hover or animation.

## Sequence the narrative

Order beats so each answer sets up the next question. Give the reader one clear idea per beat, with a
single focal visual and the minimum text to read it. Cards remain fine for genuinely parallel,
scannable items.

## Truthfulness

Show only capabilities that exist today. Derive counts and names from the project's data when
practical. Mark simplifications as such, and keep future plans visually distinct from shipped
behavior.

## Practical limits

Prefer inline SVG, CSS or real markup over heavy images or video. Keep diagrams legible at narrow
widths by recomposing them, not shrinking them. Every interactive demonstration needs keyboard access
and a static fallback.

## Stop condition

Stop when a first-time visitor could explain the product's core mechanism from the visuals alone,
and nothing on the page is purely illustrative.
