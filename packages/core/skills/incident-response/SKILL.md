---
name: incident-response
description: Restore service first, diagnose second, and learn without blame.
---

# Incident response

During an incident the goal is to stop the harm. Understanding the cause is important, but it comes
after recovery.

## Mitigate before diagnosing

Roll back, disable the feature flag, shed load or fail over. A full explanation is worth far less
than a working system, and the evidence will still be there afterwards.

## Assign roles early

Name someone to coordinate and someone to communicate, separate from those investigating. Without
this split, either the investigation or the communication is dropped.

## Keep a timeline

Record what was observed, what was changed and when, as it happens. Memory reconstructs incidents
inaccurately, and the timeline is the basis of the review.

## Change one thing at a time

Simultaneous fixes make it impossible to know what worked, and can deepen the outage. Announce each
change before making it.

## Review without blame

Examine the conditions that let the failure happen and reach production: missing tests, absent
alerts, unclear ownership. Blaming an individual guarantees the next incident is reported later.
