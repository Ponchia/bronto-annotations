# Documentation

[Published guides](https://ponchia.github.io/bronto-annotations/docs/) ·
[Runnable examples](../examples/README.md) · [Repository](../README.md)

## Start here

[Your first annotation](getting-started.md) walks from install to a visible note
in a browser or React app. Already render a chart or diagram? Use the
[adapter chooser](context-quickstart.md) to attach the first note to it.

These guides follow `main`. Use the
[0.8.2 index](https://github.com/Ponchia/bronto-annotations/blob/v0.8.2/docs/README.md)
for that release, or the [migration guide](migration-0.7.md) when upgrading
from 0.6.

## Current consumer guides

| Question | Guide |
| --- | --- |
| How do placement, manual positions, and diagnostics work? | [Core layout and geometry](core-guide.md) |
| Which callout types exist? How do I migrate d3-style input? | [Presets and migration](presets-guide.md) |
| How do I render, measure, or edit notes in React? | [React guide](react-guide.md) |
| How do I measure real rendered targets? | [DOM and generated-surface adapters](adapter-guide.md) |
| How do I change the appearance? | [Styling](styling-guide.md) |
| Why are notes missing, shifted, or overlapping? | [Troubleshooting](troubleshooting.md) |
| Where is a complete host integration? | [Examples](../examples/README.md) and [integration recipes](integration-recipes.md) |
| What is the API contract? | [API reference](api-reference.md), [stability](api-stability.md), and [compatibility](compatibility.md) |
| What should I check before shipping? | [Accessibility](accessibility.md), [performance](performance.md), and [placement quality](placement-quality.md) |
| Which advanced paths are experimental? | [Worker recipe](worker-layout.md) and [pin placement](pin-placement.md) |

For help, use [Support](../SUPPORT.md). The source, public exports, tests, and
package artifacts define the API contract if prose disagrees.

## Contributor and maintainer reference

[Contributing](../CONTRIBUTING.md) covers setup and pull requests;
[verification](verification.md) covers checks and
[property testing](property-testing.md) covers generated cases and replay.
[Release](release.md),
[release readiness](release-readiness.md), and [security automation](security-automation.md)
cover packaging, publishing, and repository safeguards.

[Architecture decisions](adr/) record the package boundary and
[quality-first policy](adr/0002-quality-before-api-expansion.md).
The [completion audit](completion-audit.json) and other API, parity, and readiness
manifests map claims to checks; their generators and verifiers live in `scripts/`.

## Historical evidence and open proposals

The [original hardening program](verification.md#pre-release-hardening) links
retained integration reports, proofs, and release plans. [Upstream consumer evidence](upstream-consumers.md)
records integration scope and limits. These records describe their fixture and
revision; they do not establish current support or independent adoption.
Plans and roadmaps are proposals, not installation instructions.

## Documentation lifecycle

Update current guides with the implementation and generated/reference material
through its owning command. Retain historical evidence and label proposals.
When retiring a path, leave a tombstone link to its replacement.
