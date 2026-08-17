---
name: web-vitals
description: Optimize loading, interactivity and layout stability for real users.
---

# Web performance

Perceived speed is decided by what the user sees and can do, not by total bytes.

## Protect the critical path

Identify what must load before the page is useful and defer everything else. Render-blocking scripts
and stylesheets delay first paint more than their size suggests.

## Ship less JavaScript

Split by route, load heavy features on demand, and remove unused dependencies. JavaScript costs
twice: once to download and again to parse and execute, and the second cost dominates on low-end
devices.

## Reserve space for content

Give images, embeds and injected banners explicit dimensions so later loads do not move what is
already visible. Layout shift is most damaging exactly when the user is about to act.

## Keep interactions responsive

Break long tasks, move heavy work off the main thread, and give immediate feedback to input. A
response that is visibly acknowledged tolerates far more latency than one that appears frozen.

## Measure real users

Field data from actual devices and networks decides whether the site is fast. Lab measurements are
for diagnosis, not for judging success.
