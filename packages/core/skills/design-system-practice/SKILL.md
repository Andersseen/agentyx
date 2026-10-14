---
name: design-system-practice
description: Extend an existing UI system through discovery, semantic reuse and deliberate new primitives.
---

# Design-system practice

Before inventing UI, inspect the project. Search for design documentation, tokens, CSS variables,
theme files, component libraries, primitives, layout utilities, icon sources, typography scales,
spacing, radii, elevation and motion helpers. Read nearby examples to learn the local API and
composition patterns.

Prefer existing components and semantic tokens. Match their variants, naming, density and responsive
behavior. Do not replace a system value with a visually similar hard-coded value or create a near
duplicate because the existing primitive needs a small extension.

Introduce a primitive only when the requirement cannot be expressed clearly with the current system.
Give it a narrow, reusable purpose, document its states and keep its API consistent with neighboring
components. Prefer semantic variants such as intent or size over arbitrary styling escape hatches.
Keep product-specific composition in the feature layer and avoid coupling this guidance to a
framework or CSS library.

When the system is incomplete, record the smallest missing token or primitive that would make the
feature coherent. Preserve the established language while filling that gap; a redesign requires an
explicit product decision, not a convenience refactor.
