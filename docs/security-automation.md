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

## Generated-input testing

`npm test` includes a bounded, deterministic fast-check suite in both supported
Node CI lanes. The separate `Property tests` workflow runs a larger campaign
nightly and on manual dispatch: 5,000 cases per property by default, with a
fresh logged seed, a 10,000-case cap and a 15-minute job timeout. It uses a
read-only token, GitHub-hosted runners and locked development dependencies;
there is no publish or deployment step.

Each run retains its seed, source revision, Node version and structured test
results for 30 days. A failing property must produce a replayable counterexample;
fix the underlying behavior or a demonstrably incorrect oracle rather than
removing difficult inputs. See [property testing](property-testing.md) for
invariants, budgets, negative controls and replay instructions. This is
property-based fuzzing, not a claim of coverage-guided or exhaustive testing.

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

Dependency Audit checks both the root dependency lock and the separate
`tooling/publisher/package-lock.json` daily, on relevant `main` changes and
on manual dispatch. Both reports preserve every advisory severity and fail on
high/critical findings or registry errors. Scanning only the root lock omitted
the source-locked publisher's separate dependency graph. The read-only job
uses npm already included in the reviewed Node distribution, rather than a
globally installed registry bundle with known advisories. Privileged publishing
still uses the independently pinned source-locked CLI and audit gates.

A 2 November 2026 audit found 31 moderately affected package entries from
two glob/minimatch advisories, not 31 separate advisories. The reviewed publisher
fix in [PR #216](https://github.com/Ponchia/bronto-annotations/pull/216) landed on
7 November. Its replacement policy and qualification are described below;
use the latest retained audit rather than treating this historical count as
current vulnerability status.

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
It also runs on every pull request and protected-main push; a manual
audit-only dispatch remains available. Protect the main branch with the
`Audit actual publisher bundle` required check alongside the existing
Node 20/22, Dependency Review and CodeQL gates. This prevents a publisher-only
dependency update from being accepted with a green library CI while its source
identity is broken. It has no publishing permission,
registry credentials, root dependency install or restored cache. The canary
publisher keeps its existing checkout-free archive boundary. The protected
`npm-publish` environment, `release.yml` trusted-publisher identity, provenance,
immutable-tag checks and publication with lifecycle scripts turned off remain
required.

The publisher is npm built from source. The registry npm bundle cannot take a
dependency fix: on 24 October 2026 every stable OIDC-capable npm 11/12 archive
from 11.5.1 onward bundled a high finding. Latest 11.21.1 and 12.2.1 bundle
`undici@6.29.0`, inside
[GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)'s
`>=6.23.0 <6.29.1` range, and `ip-address@10.7.2`, which needs 10.7.4 for
[the address parser advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).

`scripts/source-publisher.mjs` (shared with `@ponchia/ui`) therefore does not
install the registry bundle. `prepare` downloads the unchanged npm 11.21.1
source archive pinned by commit, byte count and SHA-512 in
`tooling/publisher/source.json`. `scripts/extract-publisher-source.py` extracts
exactly the listed files and refuses links or anything unexpected. It installs
the CLI's production dependencies with lifecycle scripts off, from the
separately committed `tooling/publisher/package-lock.json`, which overrides
`undici` 6.29.1, `ip-address` 10.7.4, and the security-fixed major
versions `glob` 14.0.2 and `minimatch` 11.0.1. The latter replace npm
source-declared ranges `^13.0.6` and `^10.2.5` only through explicit
`source.json` `reviewedDirectReplacements` with GHSA references and
graph-wide exact overrides; the original npm source remains unchanged. `audit` checks each installed
manifest against that lock and audits the complete graph, development
dependencies included, through `scripts/audit-publishing-tooling.mjs`. Nothing
is repacked, no bundled metadata is edited, and no advisory is waived. On
29 October 2026 the audit reported zero findings of any severity across 147
packages.

The read-only preflight, the npm publisher, the canary publisher and
release-notes recovery all prepare and audit this publisher in
`$RUNNER_TEMP/annotations-publisher`, then run its `source/bin/npm-cli.js`.
None installs npm globally. The canary publisher still runs no package code:
a non-cone sparse checkout brings in the four publisher paths and nothing
else. Retained reports include the prefix's `package-lock.json` and the raw
audit even when the audit fails. High/critical findings, nonzero CLI exits,
invalid counts, malformed responses and audit-service failures block the
dependent write job.

To update the publisher, change `source.json` (commit, URL, byte count,
SHA-512, file inventory) and the publisher lock together, then run
`npm run publisher:readiness` and full CI. Keep `scripts/source-publisher.mjs`,
`scripts/extract-publisher-source.py` and `tooling/publisher/` in step with
`@ponchia/ui`. The library's Node 20 support remains separate from the
publishing runtime. The integrity-locked registry-bundle proposal in
[PR #185](https://github.com/Ponchia/bronto-annotations/pull/185) is superseded
for publishing.

`npm run test:security-pins` includes offline failure and workflow-boundary
regressions for this guard. Normal PR and main CI now require the **actual read-only source-publisher
audit**, while publication retains independent review, identity and provenance
gates. The high-advisory registry bundle is still rejected.

### Publisher dependency advisory resolution — 7 November 2026

The pinned npm 11.21.1 source remains unchanged. Its reviewed dependency graph
now selects `glob@14.0.2` and `minimatch@11.0.1`, with explicit
`reviewedDirectReplacements` in `tooling/publisher/source.json`. The preparation
script checks each allowed source range and replacement version; unexpected
manifest changes still fail. [PR #216](https://github.com/Ponchia/bronto-annotations/pull/216)
records the implementation and tests. These are release-tool dependencies,
not shipped Annotations runtime dependencies.

Changing that policy requires a reviewed diff, lock regeneration,
`npm run publisher:readiness` and full CI. Do not apply arbitrary overrides,
suppress advisories or relax integrity checks to make an audit pass.

### Source-archive write review

[CodeQL alert 88](https://github.com/Ponchia/bronto-annotations/security/code-scanning/88)
was dismissed as a by-design source-archive write after review. It is not an
outstanding package vulnerability or proof of comprehensive safety. The write
is constrained by the pinned codeload URL, redirect refusal, a size cap and
committed SHA-512. Extraction separately verifies allowlisted file hashes and
rejects traversal, symlinks and unreviewed content. Changes to those controls
require renewed review; the regression suite remains active.

## Interpreting Scorecard findings

Read the complete report, not only the open-alert count. A finding describes a
specific control or heuristic; it is not automatically an exploitable defect.
A successful workflow also does not mean every check scored 10.

The workflow retains `scorecard.sarif` and the action's full `results.json` for
30 days as `scorecard-evidence-<run-id>-<attempt>`. Both are written before the
external results-publication step. The upload runs even after an action failure;
SARIF is submitted when that file exists. A failed scan or external publication
still fails its original step. No warning is converted into a clean scan.

```bash
gh run list --repo Ponchia/bronto-annotations --workflow scorecard.yml --limit 5
gh run download RUN_ID --repo Ponchia/bronto-annotations \
  --name scorecard-evidence-RUN_ID-ATTEMPT --dir scorecard-evidence
jq '{date, repo, scorecard, score, checks: [.checks[] | {name, score, reason}]}' \
  scorecard-evidence/results.json
```

Check `repo.commit`, scan date and tool version before comparing reports. A
score of `-1` means the check was not assessed; do not turn it into a zero or
claim that it passed. The [public viewer](https://scorecard.dev/viewer/?uri=github.com/Ponchia/bronto-annotations)
can lag a new run. Local artifacts and successful external publication are
separate evidence.

| Check | What improvement actually requires |
| --- | --- |
| Fuzzing | Executed generated-input tests with useful invariants, reproducible seeds and minimized failures. See [property testing](property-testing.md); ordinary example tests alone are not a fuzzing campaign. |
| Code Review / Branch Protection | A workable independent-reviewer process and formal reviews recognized by GitHub. Preserve required CI, administrator enforcement and the ban on force pushes. Automated review is supplementary, not a fabricated human approval. |
| CII Best Practices | Maintainer assessment and enrollment against the [actual criteria](https://www.bestpractices.dev/en/criteria). Writing documents alone does not award a badge. |
| Contributors | Genuine external contributions and the public affiliation data used by the scanner. Do not create identities or change authorship for points. |
| Signed Releases | The scanner's release-asset evidence. An unassessed GitHub-assets check does not invalidate independently verified npm provenance; use the [release verification procedure](release.md#registry-propagation). |

[Issue #232](https://github.com/Ponchia/bronto-annotations/issues/232) retains the
7 November baseline and owner-dependent follow-ups. Code and documentation
changes can improve test coverage and transparency; review permissions, badge
attestations and external participation remain explicit maintainer decisions.
