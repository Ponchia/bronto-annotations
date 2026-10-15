# 0.7 release readiness

This document separates implementation, publication, automated compatibility,
and human usability. The 0.7 API is implemented on `main`; that does not make
it the default npm version or prove every host integration.

## Choose the matching package

The confirmed stable release is **0.6.10**. Its versioned documentation is at
[the stable guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.6.10/docs/README.md).
The first candidate tag is **0.7.0-rc.1**; current development is **0.7.0-dev.1**.
Publication is not confirmed by this document. Public pages read their build version from `package.json` and
confirmed registry versions from `site/release-status.json`; the banner is
present on the homepage, every guide, and every directly linked example.
There is no runtime registry request or analytics in the example notices.

Before publication, build and pack a clean checkout, then install its tarball
in a separate disposable consumer. After the protected release succeeds and
the real registry tarball is verified, install the exact candidate version
rather than silently replacing a live application's dependency. Candidate
publication uses `next`; `latest` remains the stable 0.6 line until a deliberate
stable release. Follow [the release runbook](release.md).

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
