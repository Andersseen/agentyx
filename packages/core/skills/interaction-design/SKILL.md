---
name: interaction-design
description: Define clear, resilient component behavior and state transitions for product interfaces.
---

# Interaction design

Describe behavior before styling. For each meaningful control or component, account for the states
that users can encounter: idle, hover where relevant, focus, pressed or active, disabled, loading,
success and failure. Do not invent states that the product cannot explain or support.

For forms, choose validation timing that helps people recover: preserve input, associate feedback
with the field or step, and avoid interrupting typing. For async actions, decide whether optimistic
feedback is safe; if it is, reconcile failure with rollback or undo. Otherwise show confirmed
progress and keep the action's outcome visible. Confirm irreversible or high-impact actions when an
undo window is not sufficient.

Treat dialogs, drawers, popovers, menus and navigation as transitions with entry, exit, dismissal,
outside-click and keyboard behavior. Make the next state predictable. Provide a non-gesture path
for touch interactions. Use motion only when it explains cause and effect, preserves orientation or
confirms an outcome; make it interruptible and honor reduced-motion preferences.

Detailed semantic and ARIA implementation belongs to the `accessibility` pack. Still avoid designs
that conceal focus, rely on hover alone or make a target difficult to operate. Consider pointer,
keyboard and touch input together, including narrow screens and interrupted network requests.
