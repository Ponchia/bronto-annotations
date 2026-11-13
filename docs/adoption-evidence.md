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
