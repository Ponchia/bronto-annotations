# Documentation

Use this page to distinguish the maintained package contract from dated
incubation evidence and future work.

## Current

- [Repository README](../README.md): product boundary, package surface, and
  consumer quick start.
- [Context quick start](context-quickstart.md): use annotations in a host
  context.
- [API reference](api-reference.md): public models and helpers.
- [API stability](api-stability.md): compatibility policy.
- [Compatibility](compatibility.md): supported environments and adapters.
- [Integration recipes](integration-recipes.md): host integration examples.
- [Accessibility](accessibility.md), [performance](performance.md), and
  [release](release.md): maintained quality and release contracts.

The source tree, exports, tests, and generated package artifacts remain the
authority when reference prose disagrees.

## Decisions

Accepted decisions live under [`adr/`](adr/). They explain why the package is a
standalone product and do not replace current API documentation.

## Evidence and proposals

Files named `dogfood-*`, `*-report`, `*-proof`, `*-plan`, and `*-roadmap` are
dated evaluation evidence or proposals. They are not current API contracts.
Keep these plans source-dated, or move them under `docs/archive/` when they no longer
inform an open decision.

## Lifecycle

- Current guides change with the code they describe.
- Generated/reference material changes through its owning generator.
- Historical evaluations remain frozen evidence.
- Open plans are proposals, not claims that a feature is absent.
