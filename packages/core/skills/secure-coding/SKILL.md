---
name: secure-coding
description: Apply input validation, output encoding and least privilege by default.
---

# Secure coding

Treat every input crossing a trust boundary as hostile, including input from your own other services.

## Validate at the boundary

Validate structure, type, range and length where untrusted data enters, and reject what does not
conform. Allow-lists beat deny-lists: enumerate what is valid rather than guessing what is dangerous.

## Never build queries or commands by concatenation

Use parameterized queries and argument arrays. String interpolation into SQL, shell commands,
templates or file paths is the root of injection.

## Encode for the destination

Escaping depends on where the value lands: HTML body, attribute, URL, SQL, shell and JSON all differ.
Encode at the point of output, not on the way in.

## Apply least privilege

Give every process, token and database role the narrowest permissions that let it work. Scope
credentials per environment so a leak in one does not compromise the others.

## Fail closed

On error, deny access and log the reason. An exception path that falls through to permitted access is
a vulnerability, not a bug.
