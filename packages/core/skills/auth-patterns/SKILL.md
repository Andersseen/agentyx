---
name: auth-patterns
description: Separate authentication from authorization and enforce both server side.
---

# Authentication and authorization

Authentication establishes who is calling. Authorization decides what they may do. Conflating the two
is the most common access-control defect.

## Enforce on the server

Client-side checks are user experience, not security. Every request must be authorized independently
on the server, whatever the interface already hid.

## Authorize the object, not just the route

Verify that the authenticated principal may act on the specific resource named in the request.
Route-level checks that skip ownership let one user read another user's data by changing an
identifier.

## Keep sessions and tokens short

Prefer short-lived tokens with refresh over long-lived credentials. Give every session an expiry, and
support revocation for logout, password change and suspected compromise.

## Store credentials correctly

Hash passwords with a current memory-hard algorithm and per-user salts. Never encrypt or encode them,
and never implement the primitive yourself.

## Deny by default

New endpoints require explicit authorization rather than inheriting open access. A permission model
where forgetting a check means public access will eventually leak data.
