# Security Automation

This public repository uses GitHub-native security automation that does not
require consumer credentials or a long-lived npm token.

## Workflows

- CodeQL runs JavaScript/TypeScript code scanning on pull requests, pushes to
  `main`, a weekly schedule, and manual dispatch. The workflow uses
  `github/codeql-action/init` pinned to a reviewed v4 commit with `security-extended` and
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
  the immutable `v2.5.0` release commit, rather than a mutable version tag.
  This updates the underlying Scorecard engine to v5.6.0 while preserving
  the workflow permissions and SARIF upload behavior.
  Repository checks require a full immutable SHA on every actual Scorecard
  `uses` entry instead of duplicating one historical release SHA. Negative tests
  reject mutable tags, short hashes, comment-only pins and mixed pinned/mutable
  executions. Upstream upgrades still require review and the complete CI gates.

## Version Update Compatibility Policy

Routine Dependabot npm PRs group compatible **minor and patch** updates for
optional integrations and development tooling. Major upgrades of `mermaid`,
`typescript`, `vitest`, and `jsdom` are deferred from the **default**
verification stack until their compatibility strategy is reviewed. Newer
Vitest 5 and jsdom 30 are separately tested on Node 22 because they cannot
run under this package's supported Node 20 floor. In particular, Mermaid 12 contains
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

## Lockfile and publishing safeguards

Dependency Audit checks the entire committed npm lockfile daily, when it changes
on `main`, and on manual dispatch. It includes development tools, preserves all
advisory severities in an artifact, and fails on high/critical advisories or an
audit service error. It does not install dependency code. A failed update job or
an empty Dependabot PR queue is not evidence that the lockfile is safe.

All external workflow actions use full reviewed commit SHAs. The existing
security gate validates every executable `uses` entry, including nested action
paths. Token write permissions belong to the jobs that actually publish or
upload security results. Canary checks and builds have read access; a separate
job publishes the verified archive only from this repository's main branch,
with lifecycle scripts disabled, followed by a read-only registry smoke.

Node 22 execution jobs resolve the latest available patch with `check-latest`.
Privileged npm commands use npm 11.21.1, as does the existing isolated Node 22
next-test-runner lane. Normal CI keeps its bundled npm, including the full Node
20 verification lane. The published engine range stays intact.
`@axe-core/playwright` 4.14 requires Node 22.12; its routine updates are deferred
at 4.13 until the support decision in issue #66. This is a tooling compatibility
deferral, not a suppressed vulnerability. Revisit the version filter when that
support transition is decided.

## Publishing tooling preflight

`publishing-tooling.yml` is a reusable read-only job required by the npm
publisher, GitHub Packages canary publisher and signed release-notes recovery.
It also supports manual audit-only dispatch. It has no publishing permission,
registry credentials, root dependency install or restored cache. The canary
publisher keeps its existing checkout-free archive boundary. The protected
`npm-publish` environment, `release.yml` trusted-publisher identity, provenance,
immutable-tag checks and publication with lifecycle scripts turned off remain
required.

The job installs the exact npm candidate into a disposable prefix with
`--ignore-scripts`. `scripts/audit-publishing-tooling.mjs` verifies the expected
registry URL and SHA-512 integrity, then compares every installed dependency
manifest with the generated complete lock, including nested and scoped bundled
packages. Symlinks, missing packages, unexpected packages and metadata-only
version edits fail. The runner's npm audits that complete lock with development
dependencies included; the candidate CLI is never selected or executed.
The generated lock and raw advisory response are retained even when the audit
fails. High/critical findings, nonzero CLI exits, invalid counts, malformed
responses and audit-service failures block the dependent write job.

The candidate is **not currently safe to publish with**. On 24 October 2026,
all 34 stable OIDC-capable npm 11/12 archives from 11.5.1 onward were downloaded
and checked against their registry SHA-512 metadata. The complete actual
bundled inventories were matched against the registry advisory service; none
was free of high findings. Releases through 11.12.1 have no bundled `undici`,
but retain other high advisories, including
[brace-expansion](https://github.com/advisories/GHSA-mh99-v99m-4gvg).
Later candidates bundle `undici` 6.25.0 through 6.29.0, all within
[GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)'s
`>=6.23.0 <6.29.1` affected range. Latest npm 11.21.1 and 12.2.1 both
bundle `undici@6.29.0` and `ip-address@10.7.2`. The former also has the moderate
[EventSource advisory](https://github.com/advisories/GHSA-4qv8-2p9j-2685);
the latter requires ip-address 10.7.4 for
[the address parser advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).

Resume publication only after an official npm distribution fixes the actual
bundle and passes the complete audit. The reviewed fixed `undici` releases are
6.29.1, 7.30.1 and 8.12.2; replacing that package alone is insufficient if
other high findings remain. Update the exact install version in all workflows
and the candidate version, URL, and SHA-512 together, then run the offline
regressions, live audit and full CI. Do not repack npm, edit bundled version
metadata, waive advisories or weaken the gate. The separate integrity-lock
proposal in [PR #185](https://github.com/Ponchia/bronto-annotations/pull/185)
remains blocked; this guard introduces no vulnerable tooling lock into main.
The library's Node 20 support remains separate from the publishing runtime.

`npm run test:security-pins` includes offline failure and workflow-boundary
regressions for this guard. Normal CI does not require a successful live audit
of the known-vulnerable candidate; publication does.

## Interpreting Scorecard findings

Treat each alert as a specific control or dependency finding, not as a count of
exploitable defects. Keep the source revision and scanner run with the review.
The private-reporting link is explicit in `SECURITY.md`; a successful workflow
run does not itself prove its SARIF findings have been resolved.

Workflow CLI pinning includes the executable dependency graph, not only an npm
version string. The integrity-locking follow-up is tracked in
[PR #185](https://github.com/Ponchia/bronto-annotations/pull/185). A high advisory
in the upstream npm bundle blocks that change under Dependency Review; retain
the gate and the raw finding until a reviewed upstream fix is available.

The signed release-notes recovery workflow deliberately resolves the requested
immutable registry version before verifying its bytes and signed provenance.
That operation is not a source build and cannot be replaced by a single fixed
consumer version without breaking recovery for other releases. Its remaining
pinning warning needs contextual review, not an exclusion for all installs.

Code Review checks require a second human reviewer. Automated review and
maintainer-authored commits do not satisfy that condition; do not fabricate
approvals or contributor identities to increase the score. OpenSSF Best
Practices enrollment is a separate maintainer attestation, not a badge that a
CI change can award. A Fuzzing warning means no recognized integration was
detected; ordinary unit and browser tests are not a substitute for a dedicated
fuzzing campaign. Keep these limitations visible rather than dismissing them
as fixed dependencies.
