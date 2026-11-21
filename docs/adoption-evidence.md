# Adoption and first-integration evidence

[Documentation index](README.md) · [First-use host chooser](context-quickstart.md) ·
[Share integration feedback](https://github.com/Ponchia/bronto-annotations/issues/new?template=integration_feedback.yml)

## What we are measuring

For the primary workload—**5–20 explanatory notes on an existing chart,
diagram or report**—a successful integration must produce correctly aligned,
legible notes without taking over rendering or application state. A working
integration is not proof of frictionless setup, accessibility on physical
devices, or production adoption.

Measure each trial *from an already rendering host*, without rebuilding its
chart or graph:

1. Time from installing an exact published version to the first **visible,
   correctly anchored note**. Record "not reached" if it never works.
2. Which API entry points, measurement steps, coordinate conversions and
   host-owned lifecycle hooks were necessary; record the actual integration
   code rather than estimating a universal line count.
3. Number of notes/obstacles, viewport and transforms, missing anchors,
   manual placement required, and layout-quality violations or visible
   collisions before and after configuration.
4. Keyboard and screen-reader outcomes as **tested** on exact engines,
   devices and assistive tools; distinguish emulation from physical review.
5. Whether an **independent maintainer** chose to use the package. Running
   a fixture over upstream-authored inputs is not upstream adoption.

A trial can reveal a useful failure; it does not need to end with a passing
score. Record first attempts as well as later tuned results. Do not silently
exclude missing notes or impossible layouts to improve a score.

## Existing baseline — internal or maintainer-run evidence

| Surface | Existing proof | Outcome and limitation |
| --- | --- | --- |
| SVG figure | [SVG example](../examples/svg-basic/) and [existing-SVG quickstart](context-quickstart.md#first-note-on-a-figure) | Host renders chart; annotations use host geometry or a measured SVG mark. Executable snippet checks are internal, not an independent consumer trial. |
| DOM report | [Clean-consumer report](dogfood-clean-consumer-report.md) and [external-host report](dogfood-external-consumer-report.md) | Measured DOM regions can be annotated. Host still owns mount location, resizing and measurement timing. External host verification was maintainer-run. |
| React Flow graph | [External-host report](dogfood-external-consumer-report.md) | One dense host initially scored 0/100 with approximately 11,565 px² of host-card overlap; tuned placement scored 86/100 with zero obstacle overlap. This is useful friction evidence, not automatic quality or independent adoption. |
| Mermaid, Vega | [Pinned upstream inputs](upstream-consumers.md) | Real upstream-authored inputs render with annotation overlays in packed-package browser checks. Those projects have not thereby adopted this package. |

The current source and website may be ahead of npm. Public trial reports must
record the **installed archive version**, not only the Git revision used for
internal development.

## Run a first-time trial

Use an existing host and a developer who has not integrated this package.
Reserve **30 minutes**; stop when time runs out and keep the failed attempt.
That timebox is a way to bound the trial, not a promised setup time or a pass
threshold. An internal agent run can check instructions and fixtures, but it
must be recorded as automated or maintainer evidence rather than an unfamiliar
human's experience.

Give the participant the [existing-surface quickstart](context-quickstart.md),
the package version, and the tasks below. Let them choose the relevant path.
For the first attempt, observe without supplying code or directing clicks.
Record when help starts and exactly what help was needed; assisted success
remains useful, but is a separate milestone.

| Task | What to observe | Record before helping |
| --- | --- | --- |
| Attach one note to an existing mark | The connector meets the intended rendered target, and the note is visible and readable | Installation start, first visible note, first correctly anchored note, or `not reached`; record interruptions separately |
| Resize or pan the host and change the target's data | The note follows the intended target, or a clear stale/missing-target state is handled by the app | Lifecycle hooks, transforms and manual coordinate changes required |
| Add five useful notes | Every requested note remains accounted for; chart content and note text stay readable | First untouched layout, overlap/missing-note counts, then the tuning required |
| Edit if the application needs it | A permitted move commits, a rejected move explains why, and undo restores the last accepted state | Setup code and whether keyboard editing, rejection and undo worked; mark `not attempted` if out of scope |
| Decide whether to continue | The participant explains the value and largest remaining obstacle in their own words | Continue, try again after a named change, or stop; this is not a production-adoption claim |

### Trial record

Copy this record into local notes or the
[integration feedback form](https://github.com/Ponchia/bronto-annotations/issues/new?template=integration_feedback.yml).
The form is optional; share only material you have permission to publish.
Use `not measured`, `not reached`, and `not attempted` instead of filling gaps
with estimates.

```text
Trial kind: unfamiliar human / returning user / maintainer / automated
Prior familiarity with the package:
Installed package and host versions:
Existing surface and intended target:
Date, browser, viewport, device, and assistive tools actually used:
Install start / interruptions:
First visible note / first correctly anchored note:
Unassisted outcome:
Assistance start, help supplied, and assisted outcome:
Five-note first attempt: notes requested / rendered / missing; overlaps:
Tuning: placement overrides, measurement and lifecycle code:
Resize or data-change outcome:
Editing, rejection, and undo outcome (if attempted):
Code or reproduction and before/after images (safe to share):
Decision to continue and the largest remaining obstacle:
```

The intended target must be checked against the original host. A screenshot of
a note somewhere on the figure, or a quality score computed from the same
incorrect geometry, does not establish correct anchoring. Keep the initial
attempt separate from the tuned result. Repeating this trial as an automated
check does not create another independent consumer.

## Next independent trials

Seek real integrations in an existing SVG/chart host, a generated diagram
(Mermaid or Vega), and a node-based graph (React Flow). At least one should
be a first-time user unfamiliar with this repository. Capture the initial
application and package versions, the unmodified host, first-success
measurement, failed attempts, needed helpers and whether the person would
continue using the package. Use the [integration feedback form](https://github.com/Ponchia/bronto-annotations/issues/new?template=integration_feedback.yml)
or a minimal public reproduction; never publish private downstream code.

Consider a new stable abstraction only after a repeated, independently
observed problem in **more than one host**. A new adapter or a package-owned
editor is not justified by completing an internal implementation checklist.
This follows [ADR 0002](adr/0002-quality-before-api-expansion.md).

## Release and accessibility gates remain separate

Use [release readiness](release-readiness.md) for the current verified
published package. A passing source check is not a release. The maintainer
still controls protected npm publication and dist-tag permissions.

[Human physical-input and screen-reader acceptance](https://github.com/Ponchia/bronto-annotations/issues/122)
cannot be closed by a browser automation run. Record exact tested combinations
and defects, not an inferred guarantee from axe or touch emulation.
