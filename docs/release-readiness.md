# Release readiness

This document separates implementation, publication, automated compatibility,
and human usability. The 0.8 API (the 0.7 API plus experimental pin layout) is
the stable npm release; that does not prove
every host integration.

## Choose the matching package

The confirmed stable release is **0.8.1**, published under `latest` on
October 29, 2026. Its versioned documentation is at
[the 0.8.1 guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.8.1/docs/README.md).
Its actual npm tarball (**352,202 bytes**) was independently downloaded and
verified against registry SHA-512. A fresh consumer installed that exact version
from the public registry and passed `scripts/smoke-registry-consumer.mjs`.
Registry signature and provenance attestation verification passed, and the
signed source matches the `v0.8.1` tag commit and `release.yml`. 0.8.1 is a
patch release: in forced-colors mode a callout subject is no longer filled with
opaque Canvas over the chart it marks. 0.8 only adds to the 0.7 API; the
previous stable line is **0.7.0**
([its guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.7.0/docs/README.md)).

```sh
npm install @ponchia/annotations@0.8.1
```

[Protected 0.8.1 release](https://github.com/Ponchia/bronto-annotations/actions/runs/40943672445).
Earlier candidate archives stay immutable: RC1 does not contain RC2's
oversized-note and invalid-input fixes, and RC2 does not contain RC3's Vega
helpers.
Public pages read their build version from `package.json` and confirmed registry
versions from `site/release-status.json`. The notice is present on the homepage,
every guide and directly linked example; there is no runtime registry request
or analytics in the notice.

Verified archive SHA-512:

```text
sha512-R70T9q1R96sAwQOEomC72DnpLVZj5F+wI6RwgmqlxCaYuXBPlXumO/L8FbJfpnBSdvky+6/eMRhOdVsFGAjyUQ==
```

These are package and automated integration results, not a claim of human
accessibility acceptance or a production application deployment.

Before publication, build and pack a clean checkout, then install its tarball
in a separate disposable consumer. After the protected release succeeds and
the real registry tarball is verified, install the exact version rather than
silently replacing a live application's dependency. Candidates publish under
`next` and stable releases under `latest`. Follow [the release runbook](release.md).

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
