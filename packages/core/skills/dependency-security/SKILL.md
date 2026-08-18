---
name: dependency-security
description: Vet, pin and update third-party dependencies deliberately.
---

# Dependency security

Most code shipped in a modern application is code nobody on the team wrote. Treat adding a dependency
as a security decision.

## Vet before adding

Check maintenance activity, release history, install footprint and transitive dependency count. A
small utility that pulls in dozens of packages costs more than writing the function yourself.

## Pin and lock

Commit the lockfile and keep ranges narrow for anything security relevant. Reproducible installs are
what let you tell whether a change came from your code or from a dependency.

## Update on a schedule, not in panic

Apply security patches promptly and take routine updates in small regular batches. Large infrequent
upgrades are where breakage accumulates and where an urgent patch gets stuck behind unrelated
changes.

## Audit in CI

Fail the build on known critical vulnerabilities in the dependency tree. Review each advisory for
exploitability in your context before treating it as urgent.

## Beware install-time execution

Post-install scripts run with your permissions on developer machines and in CI. Disable them where
the toolchain allows, and know what remains enabled.
