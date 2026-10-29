# Documentation

[Published guides](https://ponchia.github.io/bronto-annotations/docs/) ·
[Runnable examples](../examples/README.md) · [Repository](../README.md)

## Start here

This branch targets development after the 0.8.0 release. Users upgrading from 0.6 should read the
[0.7 migration guide](migration-0.7.md) and [release readiness](release-readiness.md);
0.8 only adds to the 0.7 API. The [0.8.0 guide index](https://github.com/Ponchia/bronto-annotations/blob/v0.8.0/docs/README.md)
is the version-matched entry for the confirmed stable npm release.


Read [Your first annotation](getting-started.md) for a complete browser or React
example. Then use the [adapter chooser](context-quickstart.md) to connect the
engine to the surface you already render. Start with a few notes; Workers and
incremental sessions are advanced, optional paths.

Already have a surface? Start with one note on an
[SVG figure](context-quickstart.md#first-note-on-a-figure),
[DOM report](context-quickstart.md#first-note-on-a-report), or
[React Flow graph](context-quickstart.md#first-note-on-a-graph).

## Current consumer guides

| Question | Guide |
| --- | --- |
| How do I install it and see a note? | [Getting started](getting-started.md) |
| Which import fits my chart or diagram? | [Choose an adapter](context-quickstart.md) |
| How do placement, manual positions, and diagnostics work? | [Core layout and geometry](core-guide.md) |
| Which callout types exist? How do I migrate d3-style input? | [Presets and migration](presets-guide.md) |
| How do I render, measure, or edit notes in React? | [React guide](react-guide.md) |
| How do I measure real rendered targets? | [DOM and generated-surface adapters](adapter-guide.md) |
| How do I change the appearance? | [Styling](styling-guide.md) |
| Why are notes missing, shifted, or overlapping? | [Troubleshooting](troubleshooting.md) |
| Where is a complete host integration? | [Examples](../examples/README.md) and [integration recipes](integration-recipes.md) |
| What is the API contract? | [API reference](api-reference.md), [stability](api-stability.md), and [compatibility](compatibility.md) |
| What should I know before shipping? | [Accessibility](accessibility.md), [performance](performance.md), and [placement quality](placement-quality.md), and [upstream consumer proof](upstream-consumers.md) |
| How can a host run layouts off the main thread? | [Experimental Worker recipe](worker-layout.md) |

The site and these guides track `main`. Consult the installed package's
[release notes](https://github.com/Ponchia/bronto-annotations/releases) when
using a published npm version. The source, public exports, tests, and package
artifacts remain authoritative if prose disagrees.

## Contributor and maintainer reference

[Contributing](../CONTRIBUTING.md) describes setup and pull requests.
[Development and verification](verification.md) explains the complete check
pipeline. [Release](release.md) and [security automation](security-automation.md)
cover publishing and repository safeguards. For help or optional funding, read
[SUPPORT.md](../SUPPORT.md) and [FUNDING.md](../FUNDING.md).

Accepted [architecture decisions](adr/) explain the standalone package boundary.
The current [quality-first decision](adr/0002-quality-before-api-expansion.md)
prioritizes common consumer workloads and exact output before API expansion.
The API, parity, readiness, and completion JSON manifests are generated/reference
material: their owning verification commands live in `package.json` and
`scripts/`. They are not a substitute for a consumer guide or usability evidence.

## Historical evidence and open proposals

`dogfood-*`, `*-report`, `*-proof`, `*-plan`, and `*-roadmap` documents retain
integration evidence or proposals from earlier development. Their scope is the
recorded fixture and revision, not a claim of current independent adoption or
universal support. Historical `0.1.x` release planning does not mean `0.1.x` is
the current npm release. Use current guides above for installation and API use.

## Documentation lifecycle

**Current** guides change with the implementation. **Generated/reference**
material changes through its generator or verifier. **Archive** material is
historical evidence, not current instructions. **Proposals** describe open work,
not missing functionality. A retired path should retain a **tombstone** link to
its replacement instead of silently breaking existing references.

For experimental small-target geometry, see [pin placement](pin-placement.md). Its omissions and optional leaders stay separate from explanatory-note layout and host discussion state.
