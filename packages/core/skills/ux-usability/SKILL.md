---
name: ux-usability
description: Improve interfaces by organizing the path from a user's goal to a clear outcome.
---

# UX usability

Start with the primary user task and its success condition. Use sensible defaults for routine
product decisions; ask a question only when missing information would materially change the flow,
risk or audience.

Model the path before polishing screens:

- put the most important information and next action where it can be recognized;
- make affordances and navigation predictable, with wayfinding that survives refresh and return;
- reduce recall, decisions and unnecessary context switching;
- constrain invalid choices and prevent expensive mistakes;
- reveal advanced detail progressively without hiding essential context;
- make destructive actions deliberate and provide undo or a recovery route where feasible.

Design the states around the task, not only the happy path. Specify useful empty states, loading
feedback, partial results, errors with a realistic next step, and success that clearly closes the
loop. Keep users informed during asynchronous work and preserve entered information when recovery
is possible. A screen with no data should still explain what happened and what to do next.

Review the flow for dead ends, surprising transitions, unclear ownership of actions and unnecessary
choice. Pair this guidance with the `accessibility` pack for semantic, ARIA and keyboard details.
