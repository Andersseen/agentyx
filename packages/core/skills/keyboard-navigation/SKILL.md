---
name: keyboard-navigation
description: Make every interaction reachable, visible and escapable by keyboard.
---

# Keyboard navigation

Anything achievable with a pointer must be achievable with a keyboard alone. This is the fastest
accessibility check available: put the mouse away and use the feature.

## Keep order logical

Tab order should follow the visual and logical reading order. Positive tab index values override
document order and create sequences nobody can predict — leave them alone.

## Make focus visible

Every focusable element needs a clearly visible focus indicator with sufficient contrast. Removing
default outlines without replacing them makes the interface unusable for keyboard users.

## Never trap focus unintentionally

Focus must be able to leave every component. Deliberate trapping belongs only in modal dialogs, and
must always offer an escape.

## Support the expected keys

Enter and Space activate controls, Escape dismisses overlays, and arrow keys move within composite
widgets such as menus, tabs and grids. Follow platform conventions rather than inventing shortcuts.

## Offer a skip link

Let users bypass repeated navigation to reach main content. Without it, every page begins with the
same long traversal.
