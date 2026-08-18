---
name: containerization
description: Build small, reproducible and non-privileged container images.
---

# Containerization

An image is a deployment artifact. Build it to be small, identical everywhere and safe to run.

## Build in stages

Compile in a build stage and copy only the artifacts into a minimal runtime image. Shipping compilers
and development dependencies inflates both image size and attack surface.

## Order layers by volatility

Put rarely changed steps such as dependency installation before frequently changed application code.
Correct ordering turns most rebuilds into cache hits.

## Pin the base image

Reference an explicit version or digest rather than a moving tag. Rebuilding the same commit must
produce the same image, and update the base deliberately.

## Never run as root

Create an unprivileged user and drop capabilities. A container is an isolation boundary, not a
security guarantee, and root inside makes an escape far more valuable.

## Keep configuration and secrets outside

Inject configuration through environment or mounted files at runtime. Baking credentials into an
image publishes them to everyone who can pull it, permanently.

## Handle signals and report health

Ensure the process receives termination signals so shutdown is graceful, and expose readiness and
liveness endpoints so orchestrators route traffic correctly.
