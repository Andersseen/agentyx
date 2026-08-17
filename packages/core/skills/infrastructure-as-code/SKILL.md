---
name: infrastructure-as-code
description: Define infrastructure declaratively, in version control, applied automatically.
---

# Infrastructure as code

Infrastructure that exists only as manual console changes cannot be reviewed, reproduced or
recovered.

## Declare the desired state

Describe what the infrastructure should be and let the tool determine the steps. Declarative
definitions converge from any starting point; imperative scripts assume one.

## Never change production by hand

Manual edits create drift that the next automated apply will undo or conflict with. When an emergency
forces a manual change, bring it back into code immediately.

## Review the plan before applying

Read the diff of what will be created, changed and destroyed. Replacement of a stateful resource is
the failure mode that turns a routine change into data loss.

## Isolate environments

Keep separate state and credentials per environment, sharing definitions through parameters rather
than copies. Shared state is how a staging change reaches production.

## Protect the state and the secrets

Store state remotely with locking and restricted access — it contains sensitive values. Reference
secrets from a secret manager instead of committing them alongside the definitions.
