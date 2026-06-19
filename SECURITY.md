# Security Policy

## Supported Versions

Security fixes are handled on the latest released minor version until the
package reaches `1.0.0`.

## Reporting a Vulnerability

Report suspected vulnerabilities privately through GitHub private vulnerability
reporting. If that is unavailable, contact the repository owner directly and
avoid filing public issues with exploit details.

Include:

- affected version or commit
- affected public subpath
- minimal reproduction
- impact and exploitability notes
- whether optional peers or generated host content are involved

## Security Boundary

This package does not execute Mermaid or D2 source, run chart specs, persist
annotations, fetch remote data, or own application routing/workflows. Host apps are responsible for sanitizing untrusted chart, diagram, report, and note content before rendering it.

The package aims to keep the root import dependency-free and all renderer or
host integrations explicit through optional peers.

## Automation

The public repository uses CodeQL, Dependency Review, OpenSSF Scorecard,
Dependabot alerts, Dependabot security updates, automated security fixes,
private vulnerability reporting, secret scanning, and secret scanning push
protection where GitHub makes those features available. See
`docs/security-automation.md` for the workflow and repository-setting contract.
