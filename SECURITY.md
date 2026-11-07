# Security Policy

## Supported Versions

Security fixes are handled on the latest released minor version until the
package reaches `1.0.0`.

## Reporting a Vulnerability

Report suspected vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/Ponchia/bronto-annotations/security/advisories/new).
The repository has private vulnerability reporting enabled. This route reaches
the project maintainer without making the report a public issue.

If GitHub cannot open the form, do not post the vulnerability in a public issue.
A minimal issue titled "Private security reporting unavailable", without exploit details
or affected-system information, can request restoration of the private route.
There is no separate confidential project mailbox advertised by this policy.

Include:

- affected version or commit
- affected public subpath
- minimal reproduction
- impact and exploitability notes
- whether optional peers or generated host content are involved

## Triage and coordinated disclosure

The maintainer assesses reproducibility, impact, supported versions and the
host/package boundary with the reporter in the private advisory. Coordinate a
fix and public advisory before disclosing exploit details. Maintainer availability
varies; no fixed response or resolution time is guaranteed. A missing response
must not be interpreted as confirmation that a report is harmless.

For ordinary integration problems, use [SUPPORT.md](SUPPORT.md). Conduct and
harassment reports follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), not the
vulnerability channel.

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
