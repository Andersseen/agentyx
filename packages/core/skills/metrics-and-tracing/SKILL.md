---
name: metrics-and-tracing
description: Instrument systems so failures are visible before users report them.
---

# Metrics and tracing

Instrumentation should answer whether the system is healthy, and if not, where it broke.

## Measure what users experience

Track request rate, error rate, latency and saturation at the boundaries users touch. Internal
counters that no symptom maps to generate noise rather than signal.

## Use percentiles, never averages

Averages conceal the tail where the damage is. Watch the high percentiles, because those are the
requests people notice and complain about.

## Trace across service boundaries

Distributed traces show where time is spent in a request that crosses processes. In any system of
more than a couple of services, this is the only practical way to locate latency.

## Alert on symptoms, not causes

Alert when users are affected, and let dashboards explain why. Cause-based alerts fire on conditions
that are frequently harmless, and their volume trains people to ignore them.

## Make every alert actionable

An alert nobody can act on is noise that erodes attention. Each one needs an owner, a clear
meaning and a documented first response.
