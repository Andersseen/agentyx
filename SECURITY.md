# Security Policy

## Supported versions

Agentyx is pre-1.0. Only the latest release on `main` receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.x     | ✅        |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately through
[GitHub Security Advisories](https://github.com/Andersseen/agentyx/security/advisories/new), or by
email to andriipap01@gmail.com.

Please include:

- a description of the issue and its impact,
- the affected package and version,
- steps to reproduce, ideally a minimal `.agentyx.json` or command.

You can expect an acknowledgement within 7 days and an assessment within 30 days. Once a fix is
released, you will be credited in the advisory unless you prefer otherwise.

## Scope

Agentyx reads `.agentyx.json` from a project directory and prints resolved configuration. Reports that
are in scope include, for example, path traversal when resolving configuration, code execution
triggered by parsing a configuration file, and dependency vulnerabilities reachable from published
package code.

Out of scope: issues that require a user to deliberately run untrusted code, and vulnerabilities in
projects that merely use Agentyx.
