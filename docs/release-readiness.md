# Release readiness

This document separates implementation, publication, automated compatibility,
and human usability. The 0.8 API (the 0.7 API plus experimental pin layout) is
the stable npm release; that does not prove
every host integration.

## Choose the matching package

The confirmed stable release is **0.8.3**. Install its verified npm archive:

```bash
npm install @ponchia/annotations@0.8.3
```

Use the [0.8.3 guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.8.3/docs/README.md)
for the immutable source matching those package bytes. The
[release run](https://github.com/Ponchia/bronto-annotations/actions/runs/42401260630)
published the package from `v0.8.3` at
`b7c65bedb20ed517eb6f2168be1fcce7e89b2dcd`. On November 7, 2026:

- The official **363,251-byte** archive matched its registry SHA-512:
  `sha512-qk4uhVBf4y6RCSAykMZP3rAsJkbSJE2CrocPBXFKnvu0pN6jvrET/2S4vC05bmre4ZEKp7BpG4C1cheST4rAGA==`.
- Independent fresh-cache registry consumers passed the DOM-free root, SVG/CSS,
  original-obstacle quality, single-call copied-route, structural host-input and
  path-midpoint checks without installing optional peers.
- npm verified the package signatures and both publication/provenance
  attestations. The [canonical asset verification run](https://github.com/Ponchia/bronto-annotations/actions/runs/42402503593)
  additionally enforced the original certificate identity, issuer and source
  commit policy before producing its dry-run plan.

The new release does not claim arbitrary-precision geometry or a transaction
across all mutable host state. [Placement quality](placement-quality.md) and
[adapter guidance](adapter-guide.md) state the supported validation and snapshot
boundaries. Physical-input/screen-reader and independent human-consumer
acceptance remain separate from automated checks.

The old preview channel is still a distinct
[permission decision](https://github.com/Ponchia/bronto-annotations/issues/231).
The successful immutable publication and `latest=0.8.3` do not depend on running
that denied cleanup. Do not republish the package to repair channel tags.

0.8 adds to the 0.7 API. The previous stable minor line is **0.7.0**
([its guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.7.0/docs/README.md)).
Public pages read their build version from `package.json` and confirmed registry
versions from `site/release-status.json`. The notice appears on every guide and
directly linked example, without a runtime registry request or analytics.

Before publication, build and pack a clean checkout, then install its tarball
in a separate disposable consumer. After the protected release and actual
registry bytes are verified, install that exact version. Candidates use `next`
and stable releases use `latest`; follow [the release runbook](release.md).

## Historical 0.8.2 publication evidence

The earlier stable release **0.8.2** was published under `latest` on
November 7, 2026. Use the [0.8.2 guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.8.2/docs/README.md)
with this install:

```sh
npm install @ponchia/annotations@0.8.2
```

The actual **356,165-byte** npm archive was independently downloaded and checked
against registry SHA-512. A fresh registry consumer passed root-without-DOM or
optional-peers, SVG/CSS and the corrected D2/React Flow behavior. All seven
recipes copied from the live playground type-checked and ran against the
registry-installed package; the six scene/mode geometries matched.

`npm audit signatures --json --include-attestations` verified the signatures.
The signed provenance and npm publication attestations were then bound to the
exact archive, repository, `v0.8.2` tag, source commit
`bb83813c8d593e0b722ddedf0b0bb66825b2b2e5` and `release.yml`.
The [publication and consumer record](https://github.com/Ponchia/bronto-annotations/pull/230#issuecomment-6709197576)
retains these observations and their limits.

Verified 0.8.2 archive SHA-512:

```text
sha512-+RQGrJ0fAYuzikj2mT5B2zUlBUFB1XJIttaiiqqYj0ytNycZAahnKr+GGwKYlRdFzqk0Z09Wgp+T55EylsLBlQ==
```

[Release run 42382465752, attempt 2](https://github.com/Ponchia/bronto-annotations/actions/runs/42382465752/attempts/2)
published the package. Its separate stale-channel cleanup was denied permission;
[issue #231](https://github.com/Ponchia/bronto-annotations/issues/231) tracks that
operation. The stable package is available; a stale `next` tag is not a
recommendation to use an older candidate. Do not republish 0.8.2 to fix cleanup.

## Historical 0.8.1 publication evidence

The 0.8.1 release was published on October 29, 2026 through
[run 40943672445](https://github.com/Ponchia/bronto-annotations/actions/runs/40943672445).
Its **352,202 bytes** and SHA-512 were independently verified. A fresh public
registry consumer passed `scripts/smoke-registry-consumer.mjs`, and signature
and provenance verification matched `v0.8.1` and `release.yml`. The patch stopped
forced-colors subjects from filling opaque Canvas over their host chart.

```text
sha512-R70T9q1R96sAwQOEomC72DnpLVZj5F+wI6RwgmqlxCaYuXBPlXumO/L8FbJfpnBSdvky+6/eMRhOdVsFGAjyUQ==
```

These bytes and observations belong to 0.8.1, not to the current archive.
Earlier candidate archives also stay immutable: RC1 lacks RC2's oversized-note
and invalid-input fixes; RC2 lacks RC3's Vega helpers. Historical package and
automated integration evidence does not establish human accessibility
acceptance or production deployment.

## Automated acceptance

The release candidate must pass the same Node 20/22, packed-consumer, exported
TypeScript, deterministic layout-quality, and browser gates as current main.
The Firefox/WebKit lane exercises transformed editing, DOM measurements, and
Worker revisions. The separate **Worker performance evidence** workflow stores
repeated production Chromium results for 40/200 notes at desktop/mobile sizes,
plus Node transport and repeated patch-encoding samples. Each measured update
still checks authoritative fresh-layout parity. No timing threshold is a proxy
for correctness or a frame-rate guarantee.

First-party application canaries are useful integration evidence, not independent
OSS adoption. Record the actual application revision, package/tarball identity,
checks and observed host fixes in the consumer's private records; do not add
private application names, source paths or data to this public repository.
A committed dependency upgrade and a deployment are separate decisions.

## Human acceptance still required

Automated browser and axe results do not establish physical-device or screen-reader
usability. Before presenting interactive editing as production-hardened, complete
and retain the following checks with the exact candidate and environment:

| Check | Procedure | Record |
| --- | --- | --- |
| Screen reader | Read chart description and notes, reach edit handles, edit by keyboard, reject an invalid drop, and hear the status without losing focus. | Browser, OS, assistive technology/version; result and defects. |
| Physical touch and pen | Select crowded targets, drag under zoom/pan, cancel a gesture, and scroll the background without moving a note. | Device, input type, zoom, result and defects. |
| Focus and magnification | Use keyboard-only editing, 200% text/browser zoom, and narrow viewports. Confirm visibility and a usable way to recover selection. | Exact viewport/zoom and focus failures. |
| Real authored scenes | Try early and late edits, long multilingual text, changed obstacles, manual notes and impossible crowding. | Host revision, expected behavior and reproduction. |

These rows are **not completed** merely because a screenshot was captured.
Retain defects and real observations rather than replacing manual checks with
more claims in a readiness manifest.

## Remaining engineering decisions

The implemented incremental engine and compact Worker recipe remain experimental.
The outstanding work is representative consumer profiling and a decision about
which guarantees to stabilize, not inventing a package-owned Worker scheduler.
Newer toolchain lanes already exist; changing defaults must preserve or explicitly
revise the Node 20 support policy. Registry observation remains advisory after a
successful immutable npm publication. Notes-only recovery is implemented, but
retrying npm publication itself must never be described as generally idempotent.


### Text-first authoring acceptance

For this development source, include the full-text note list and optional
full-diagram controls in human review. Read every long or diagram-hidden note,
select via keyboard, apply text and undo, use the direct diagram/return controls,
and collapse a focused diagram under magnification. Confirm that focus and the
selected note remain understandable after removal/import. Record the exact
package/revision, device, browser and assistive technology. Automated scenarios
exercise these paths, but do not turn this checklist into completed human evidence.
