---
name: semantic-html
description: Use native elements and structure so accessibility works by default.
---

# Semantic markup

The accessible behavior of a native element is free and correct. Recreating it is expensive and
rarely complete.

## Use the element that means it

Buttons, links, form controls, lists and headings carry role, keyboard behavior and state to
assistive technology. A styled container with a click handler carries none of it.

## Distinguish links from buttons

A link navigates, a button performs an action. Choosing by appearance breaks expectations for
keyboard, screen reader and browser features such as opening in a new tab.

## Structure with headings and landmarks

Use one descriptive page title, a logical heading order without skipped levels, and landmark regions
for navigation, main content and complements. Many users navigate by these alone.

## Label every control

Associate a visible label with each input. Placeholders disappear on entry and are not labels;
icon-only controls need an accessible name.

## Describe meaningful images

Give informative images alt text conveying their purpose, and mark decorative images as such. Alt
text should say what the image communicates, not what it depicts.
