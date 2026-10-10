# Security Automation

This public repository uses GitHub-native security automation that does not
require consumer credentials or a long-lived npm token.

## Workflows

- CodeQL runs JavaScript/TypeScript code scanning on pull requests, pushes to
  `main`, a weekly schedule, and manual dispatch. The workflow uses
  `github/codeql-action/init@v4` with `security-extended` and
  `security-and-quality` queries, then uploads results through code scanning.
  `.github/codeql/codeql-config.yml` excludes only
  `js/html-constructed-from-input`: this package intentionally exposes escaped
  SVG string renderers, and the renderer API docs plus `SECURITY.md` define the
  host sanitization boundary.
- Dependency Review runs on pull requests and blocks dependency changes that
  introduce high-or-worse known vulnerabilities.
- OpenSSF Scorecard runs on pushes to `main`, branch protection changes, a
  weekly schedule, and manual dispatch. It publishes Scorecard results and
  uploads SARIF into GitHub code scanning. The Scorecard action is pinned to
  the immutable `v2.4.4` release commit, rather than a mutable version tag.
  This updates the underlying Scorecard engine to v5.5.0 while preserving
  the workflow permissions and SARIF upload behavior.

## Version Update Compatibility Policy

Routine Dependabot npm PRs group compatible **minor and patch** updates for
optional integrations and development tooling. Major upgrades of `mermaid`,
`typescript`, `vitest`, and `jsdom` are deferred until their next compatibility
lane is deliberately reviewed and tested. In particular, Mermaid 12 contains
parser dependencies requiring Node 22, while the public package still promises
Node 20 support; replacing the Mermaid 11 verification lane automatically
would remove existing compatibility evidence.

The `ignore` rules affect **version updates**, not Dependabot's independent
security alerts or security updates. A major upgrade can be reviewed in a
dedicated PR with corresponding changes to the compatibility matrix, tests,
Node/runtime support policy, and public docs. Remove or revise the ignore rule
when that upgrade is supported; do not weaken matrix assertions just to make
a grouped dependency PR pass.

GitHub Actions upgrades stay in their separate Dependabot ecosystem so their
runner permissions and trusted-publishing controls can be audited individually.

## Runner Policy

This repository is public. Public pull-request validation stays on standard
GitHub-hosted runners because each job runs on an isolated clean VM, and
standard GitHub-hosted runner usage is free for public repositories. Do not move
`pull_request` jobs such as CI, CodeQL, or Dependency Review to a self-hosted,
ARC, or VPS runner label.

Some private or deploy-focused repositories may use repository-scoped
self-hosted runner scale sets for trusted build and deploy jobs. If this package
ever needs a self-hosted runner, create a dedicated repository-scoped runner and
use it only for trusted `push`, tag, or `workflow_dispatch` jobs after reviewing
token, secret, network, and filesystem exposure. Keep public PR and security
validation on `ubuntu-latest`.

## Repository Settings

The GitHub repository should keep these security settings enabled:

- Dependabot alerts.
- Dependabot security updates.
- Automated security fixes.
- Private vulnerability reporting.
- Secret scanning.
- Secret scanning push protection.

GitHub may leave optional secret-scanning features such as non-provider pattern
scanning or validity checks disabled depending on account and repository
availability. Those are useful when available, but they are not required for
the package release lane.

## Local Proof

`npm run test:security-automation` checks the workflow files, security docs,
package scripts, and repository-readiness wiring. It cannot prove GitHub
account-level toggles locally; verify those with:

```bash
gh api repos/Ponchia/bronto-annotations --jq '{security_and_analysis}'
gh api repos/Ponchia/bronto-annotations/private-vulnerability-reporting --jq '{enabled}'
```

`npm run check` includes the local security automation check.

## Transitive parser advisories

The package has no core runtime dependencies. The documentation/demo toolchain
brings in parsers through optional Mermaid and other development dependencies.
After auditing those dependencies, the lockfile selects patched versions of
`smol-toml`, `source-map-js` and `dompurify`. Mermaid 11 currently declares an
older KaTeX range that includes a low-severity advisory, so the repository
uses an explicit **development/build-tool override** for KaTeX 0.19.0.
This is not a runtime dependency of `@ponchia/annotations`.

The override is validated by the Mermaid generated-SVG adapter, packed
consumer, browser screenshot, compatibility and full repository test suites.
Revisit it when Mermaid itself raises its KaTeX range; do not downgrade Mermaid
or silently suppress an advisory to make the audit green.
