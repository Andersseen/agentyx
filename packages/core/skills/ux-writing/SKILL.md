---
name: ux-writing
description: Write clear, consistent product interface copy that helps people act and recover.
---

# UX writing

Write for the task in front of the person, not for marketing. Use familiar, consistent terminology
and let labels reveal the action and its consequence. Prefer “Save API key” or “Remove member” to a
vague “Continue” when the result is known. Useful beats clever; concise does not mean cryptic.

Apply the same standard to every state:

- labels and buttons say what happens next;
- descriptions and hints answer the question that blocks progress;
- validation explains what is wrong and how to correct it;
- errors describe a realistic recovery path without blaming the person;
- empty states explain why content is absent and offer a useful next step;
- loading and progress text sets an honest expectation;
- success and confirmation text names what changed and what can happen now;
- onboarding introduces only the context needed for the next decision.

Keep terminology stable across navigation, forms, notifications and documentation. Allow for
localization and text expansion: do not encode meaning in truncation or assume every label fits in
English. Use extra care for financial, medical, security and other high-stakes language; make scope,
consequence and uncertainty explicit.
