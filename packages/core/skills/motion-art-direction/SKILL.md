---
name: motion-art-direction
description: Find a motion language that belongs to the product and use it for causality, sequence and emphasis, with reduced-motion support.
---

# Motion art direction

Use this when a web experience will include animation beyond simple state feedback. Motion is
optional enhancement that explains; it is not a coat of polish applied to every block.

## Derive the language from the product

Ask what the product actually does and how that could move: resolving, routing, connecting,
filtering, accumulating, locking into place, transforming input into output. Choose one orchestrated
concept and a few repeatable behaviors, and write them down before animating:

- the metaphor and the events that trigger it;
- timing and easing character, shared across the site;
- what moves, what stays still and what never animates.

## Use motion for a purpose

Allowed purposes: causality (this led to that), orientation (where did that come from), sequencing
(read in this order), transformation (this becomes that) and emphasis (look here now). If a motion
serves none of these, remove it.

Avoid the defaults: every section fading and sliding up on scroll, every card lifting on hover, every
button scaling on tap. One memorable sequence beats many identical reveals.

## Restraint and control

- Animate transform and opacity; avoid animating layout.
- Keep durations short and interruptible; never block reading or interaction.
- Trigger once when meaningful, not on every scroll pass.
- Do not autoplay looping motion that cannot be paused.

## Reduced motion and fallbacks

Honor the reduced-motion preference by replacing movement with an instant or cross-fade state, while
keeping the information. Content must be fully readable with scripts, motion or the animation library
unavailable. Server-rendered output should show the final state, not a hidden one.

## Verification

Check the first paint, the animated sequence, the end state and the reduced-motion state. Confirm no
layout shift, no stuck intermediate state and no cost to input responsiveness.

## Stop condition

Stop when the motion can be described in one sentence that mentions the product, not in terms of
effects.
