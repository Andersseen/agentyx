---
name: deployment-safety
description: Release in small increments with a fast, tested way back.
---

# Deployment safety

The goal is not to avoid failed deployments but to make them cheap and quickly reversible.

## Deploy small and often

Frequent small releases are safer than infrequent large ones. When a deployment contains one change,
the cause of any new problem is unambiguous.

## Always have a way back

Know how to roll back before deploying, and test that path. A rollback procedure that has never been
exercised is an assumption, not a plan.

## Roll out progressively

Expose new versions to a small share of traffic first and widen as signals stay healthy. Most
failures appear immediately under real traffic, which no staging environment reproduces.

## Separate deploy from release

Ship code dark and enable it with a flag. This decouples the risk of deployment from the risk of the
feature, and makes disabling instant.

## Watch after shipping

Monitor error rates, latency and business metrics through the rollout, with clear criteria for
aborting. A deployment is not finished when it completes; it is finished when it is verified healthy.
