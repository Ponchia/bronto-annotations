# Project governance

Bronto Annotations is maintained by [Zeno Trevisan / Ponchia](https://github.com/Ponchia).
It is currently a single-maintainer project. [CODEOWNERS](.github/CODEOWNERS)
identifies the maintainer responsible for repository changes; it does not imply
an independent review team.

## Decisions and contributions

Use issues to describe a problem, discuss a proposed change, or contribute an
integration report. Small fixes can start with a pull request. Changes to public
APIs, supported environments, or the product boundary should start with an issue
so alternatives and compatibility can be discussed before implementation.

The maintainer decides scope and releases after considering the discussion and
verification evidence. Significant design decisions belong in [architecture
decisions](docs/adr/); user-facing changes belong in the changelog and current
guides. Decisions, including a declined proposal and its rationale, should stay
linked from the issue or pull request.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, focused checks, and pull requests.
Participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). Funding is
optional and [does not purchase priority or a feature](FUNDING.md).

## Review and merge policy

Changes go through pull requests and the repository's required checks. Include
what changed, the tested revision, the checks actually run, and relevant limits.
A passing check or an automated review is useful evidence; automated reviews
and self-reviews do not count as independent human approval.

As of November 2026, the sole maintainer can merge their own pull requests after
required checks pass. This is a limitation of the current review model, not an
independent-review guarantee. Do not manufacture approvals or use alternate
identities to improve a metric. The next review-policy step is to establish a
real independent reviewer before making their approval a required merge gate.

Preserve existing required checks, conversation resolution, administrator
enforcement and the prohibition on force pushes and branch deletion. A policy
change needs an explicit, workable maintainer decision. See the tracked
[repository-assurance work](https://github.com/Ponchia/bronto-annotations/issues/232)
for remaining review and assurance gaps.

## Maintainer responsibilities

The maintainer triages reports, maintains the public contract, and owns release
and access decisions. Regular contributors can discuss broader responsibilities
in a public issue. Describe the proposed area and previous contributions; access
is granted deliberately, with the minimum permissions needed. This document
neither grants access nor promises a role after a fixed number of contributions.

Availability varies. There is no guaranteed support or security-response time.
Use [SUPPORT.md](SUPPORT.md) for ordinary questions and [SECURITY.md](SECURITY.md)
for private vulnerability reports. Conduct concerns follow the reporting routes
in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), including the independent GitHub route.

## Releases and compatibility

The [release runbook](docs/release.md) owns preparation, protected publishing,
provenance and post-publication verification. A Git tag or passing CI alone does
not prove that a package is available from npm. Documentation must distinguish
source examples from the confirmed stable package.

Preserve published package versions and release tags. A history rewrite or
permission change requires a separate explicit maintainer decision; routine
maintenance is not an authorization to bypass a failed security gate.

The [API stability guide](docs/api-stability.md) identifies experimental paths.
A removal or breaking change needs an explicit compatibility assessment and
migration guidance rather than an undocumented change in a patch release.
