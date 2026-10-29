# Bronto Annotations

> Docs and demos track **main (`0.8.0`)**. Stable npm: **0.8.0**.
> [Choose your version](#install).

**Explain an existing chart, diagram, or interface without rebuilding it.**

[Website](https://ponchia.github.io/bronto-annotations/) ·
[Try placement](https://ponchia.github.io/bronto-annotations/#playground) ·
[Try editing](https://ponchia.github.io/bronto-annotations/examples/react-incremental/) ·
[Documentation](https://ponchia.github.io/bronto-annotations/docs/) ·
[Support development](FUNDING.md)

[![npm version](https://img.shields.io/npm/v/@ponchia/annotations)](https://www.npmjs.com/package/@ponchia/annotations)
[![CI](https://github.com/Ponchia/bronto-annotations/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Ponchia/bronto-annotations/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

![Annotations over an SVG chart](https://raw.githubusercontent.com/Ponchia/bronto-annotations/main/site/media/svg-basic.jpg)

`@ponchia/annotations` is a headless TypeScript engine for explanatory notes.
Your application supplies points, boxes, paths, or rendered host geometry;
the engine places notes and connectors around it. Render the result as SVG
or through the optional React layer.

Use it for persistent callouts on technical diagrams, explanatory chart notes,
and annotated reports. For one fixed label or a tooltip that already fits your
charting library, a built-in label is often simpler.

It does not render charts, parse diagram languages, lay out graphs, own
application state or persistence, or provide a design system.

## Install

```bash
npm install @ponchia/annotations@0.8.0
```

Use the [0.8.0 documentation](https://github.com/Ponchia/bronto-annotations/blob/v0.8.0/docs/README.md)
with this stable install. 0.8 only adds to the 0.7 API, so upgrading from 0.7 needs
no code change; the [0.7.0 documentation](https://github.com/Ponchia/bronto-annotations/blob/v0.7.0/docs/README.md) still
matches the previous stable line. Read the [0.7 migration guide](docs/migration-0.7.md)
before upgrading from 0.6. This README and the website follow `main`;
use the tagged guide when matching documentation to installed package bytes. See
[release readiness](docs/release-readiness.md) for source-testing instructions.

ES modules only. The root import has no runtime dependencies and is DOM-free;
React and adapter peer packages are optional. React applications also need
`react` and `react-dom`. See [compatibility](docs/compatibility.md) for tested
versions rather than interpreting an open-ended peer range as a support promise.

The website and this README follow `main`; npm follows published releases.
Use the [release notes](https://github.com/Ponchia/bronto-annotations/releases)
when matching a guide to the package version installed in your application.

## Core Usage

This complete browser example uses a bundler with TypeScript and CSS imports.
It draws a note attached to a point, not a chart. A chart or diagram remains
owned by your application.

```ts
import {
  resolveAnnotationLayout,
  renderAnnotationsSvg,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const annotations: Annotation[] = [{
  id: 'peak',
  anchor: { type: 'point', point: { x: 60, y: 120 } },
  note: { title: 'Peak response', body: 'An explanation attached to this point.' },
  placement: { side: 'right' }
}];

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 400, height: 240 },
  padding: 16
});

const container = document.createElement('div');
container.style.maxWidth = '640px';
container.style.fontFamily = 'system-ui, sans-serif';
container.style.aspectRatio = '400 / 240';
container.innerHTML = renderAnnotationsSvg(layout, {
  title: 'An annotated point',
  markerIdPrefix: 'first-annotation'
});
document.body.append(container);
```

Start with the [first-annotation guide](docs/getting-started.md) for local setup,
React, and coordinate-space basics. The [SVG example](examples/svg-basic/)
shows annotations together with an actual host-rendered figure.
For an existing surface, choose a first-success path for
[SVG](docs/context-quickstart.md#first-note-on-a-figure),
[DOM report](docs/context-quickstart.md#first-note-on-a-report), or
[React Flow](docs/context-quickstart.md#first-note-on-a-graph).

## React

Use `AnnotationLayer` from `@ponchia/annotations/react`. The host owns annotation
state and decides which edit callbacks to commit. The [React guide](docs/react-guide.md)
covers rendering, measurements, keyboard editing, and drag previews.

The [interactive example](https://ponchia.github.io/bronto-annotations/examples/react-incremental/)
demonstrates text editing, bounded undo/redo, and JSON import/export. Those are
host-owned example features, not a built-in persistence or editor framework.

## Adapters

Choose only the entry point you need. Host libraries are not imported by the core.

| Existing surface | Import | Runnable source |
| --- | --- | --- |
| SVG / host geometry | `@ponchia/annotations` | [SVG](examples/svg-basic/) |
| React | `@ponchia/annotations/react` | [React](examples/react-basic/) |
| DOM / report regions | `@ponchia/annotations/dom` | [DOM](examples/dom-basic/) |
| Vega / Vega-Lite | `@ponchia/annotations/vega` | [Vega](examples/vega-basic/) |
| Mermaid | `@ponchia/annotations/mermaid` | [Mermaid](examples/mermaid-basic/) |
| D2 | `@ponchia/annotations/d2` | [D2](examples/d2-basic/) |
| React Flow | `@ponchia/annotations/react-flow` | [React Flow](examples/react-flow-basic/) |

The [adapter chooser](docs/context-quickstart.md) explains where each adapter
gets its geometry and when to measure it.

## Documentation

<a id="geometry-helpers"></a>
<a id="layout-diagnostics"></a>
<a id="presets"></a>
<a id="d3-style-migration"></a>
<a id="dom-and-svg-utilities"></a>
<a id="styling"></a>

| Task | Guide |
| --- | --- |
| Place notes, preserve manual positions, inspect layout quality | [Core layout and geometry](docs/core-guide.md) |
| Use callout types or migrate d3-style annotations | [Presets and migration](docs/presets-guide.md) |
| Render and edit in React | [React rendering and editing](docs/react-guide.md) |
| Attach to real DOM, chart, and diagram targets | [Adapter guide](docs/adapter-guide.md) |
| Change the appearance without adopting BrontoUI | [Styling](docs/styling-guide.md) |
| Debug missing notes, offsets, wrapping, or slow edits | [Troubleshooting](docs/troubleshooting.md) |
| Look up a public API | [API reference](docs/api-reference.md) |

The [documentation index](docs/README.md) separates current guides from historical
audits and proposals. Detailed examples formerly on this page are in the guides
above; they have not been removed from the project.

## Run the examples

<a id="examples-and-checks"></a>

```bash
git clone https://github.com/Ponchia/bronto-annotations.git
cd bronto-annotations
npm ci
npm run example -- examples/svg-basic
```

Open the local URL printed by Vite. Run commands from the repository root.
The [example catalog](examples/README.md) lists every demo, what to try, and
which code belongs to the host. No account, API key, or backend is needed.

## Known Limits

Placement is deterministic candidate scoring with optional bounded refinement,
not a global constraint solver. Crowded notes may still overlap; inspect quality
diagnostics and reduce or manually place notes when the surface cannot fit them.

Dense full layouts can be expensive. Incremental layout is experimental and
reuses only provably unchanged work; a global change may need a full solve.
The [Worker recipe](docs/worker-layout.md) keeps scheduling and cancellation in
the host. It is not a package-owned Worker API or a frame-rate guarantee.

SVG coordinates, host transforms, and measured text sizes must agree.
See [accessibility](docs/accessibility.md), [performance](docs/performance.md),
and [API stability](docs/api-stability.md) before adopting an experimental path.

## Contributing and support

<a id="repository-quality"></a>
<a id="pre-release-hardening"></a>
<a id="future-work"></a>

Bug reproductions, integration feedback, and clearer examples are especially
welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks, or
[SUPPORT.md](SUPPORT.md) for help and reporting guidelines.

Maintainers use `npm run check`; the [verification guide](docs/verification.md)
explains the checks and release process. The [completion audit](docs/completion-audit.json)
records evidence, not a guarantee for every consumer. Security issues follow
[SECURITY.md](SECURITY.md), not public bug reports.

## Funding

Development is maintained by [Zeno Trevisan / Ponchia](https://brontolotto.observer/).
Support it on [Ko-fi](https://ko-fi.com/ponchia), or help by reporting integration
friction and contributing documentation. See [FUNDING.md](FUNDING.md).

## Prior Art And Inspiration

The subject / connector / note grammar is directly inspired by Susie Lu's
[d3-annotation](https://d3-annotation.susielu.com/) and
[react-annotation](https://susielu.com/data-viz/annotations).
This is an independent DOM-free TypeScript implementation, not a wrapper,
vendor copy, or drop-in replacement for either library.

BrontoUI is an optional visual companion, not a runtime dependency.
[MIT licensed](LICENSE).


### Public website analytics

The [GitHub Pages documentation and playground](https://ponchia.github.io/bronto-annotations/)
use Cloudflare Web Analytics for anonymous, aggregate pageview and performance
measurement. Only generated editorial pages at `ponchia.github.io/bronto-annotations/`
load the consent-free, cookie-free beacon; no script is added to the npm package,
its runtime, standalone examples, local development, or other GitHub Pages
projects. This is manual installation: do not enable zone-wide injection.
Cloudflare's [privacy policy](https://www.cloudflare.com/privacypolicy/)
provides further information about its data processing.
