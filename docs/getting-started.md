# Your first annotation

> This guide follows `main`. [Choose your version](#choose-your-version) before
> installing: stable, published candidate, and source are separate choices.

[Documentation index](README.md) · [Choose an adapter](context-quickstart.md)

The smallest integration has three parts: your host supplies an anchor, the
engine places a note, and a renderer displays the resolved geometry. Begin with
one or two notes before adding measurements, editable state, or a Worker.

## Choose your version

| You want | Install and matching guidance |
| --- | --- |
| The stable release | `npm install @ponchia/annotations@0.6.10` and the [0.6.10 guide](https://github.com/Ponchia/bronto-annotations/blob/v0.6.10/docs/getting-started.md) |
| The published 0.7 candidate | `npm install @ponchia/annotations@0.7.0-rc.3` and the [RC3 guide](https://github.com/Ponchia/bronto-annotations/blob/v0.7.0-rc.3/docs/getting-started.md) |
| The exact source shown here | Clone `main` and run the examples below |

The RC3 candidate is published and its actual npm bytes were verified.
The stable release remains on the 0.6 line; select the candidate deliberately.
The standalone setup below pins the published candidate. Its first-point API
also exists in this checkout, but newer source features may differ. Use the
[migration guide](migration-0.7.md) when upgrading and
[release readiness](release-readiness.md) when building and packing source for
an isolated consumer. A `next` tag or Git tag does not establish publication
of later source versions.

## Try the existing examples

Use a Node version supported by [the compatibility matrix](compatibility.md).
From a terminal:

```bash
git clone https://github.com/Ponchia/bronto-annotations.git
cd bronto-annotations
npm ci
npm run example -- examples/svg-basic
```

Open the local URL printed by Vite, normally `http://localhost:5173`.
The example draws a host figure and its annotation layer. Its
[source](../examples/svg-basic/main.ts) uses the same public imports as an
application outside the repository. Stop the server with Ctrl+C.

For React, run `npm run example -- examples/react-basic` instead. The
[example catalog](../examples/README.md) explains the more advanced demos.
Examples are source fixtures, not separate npm packages; install dependencies
and run commands at the repository root.

## Start a new application without cloning this repository

For a small independent browser project, use the Vite 8 major tested by this
repository and a Node version from the [compatibility matrix](compatibility.md):

```bash
mkdir annotation-demo
cd annotation-demo
npm init -y
npm install @ponchia/annotations@0.7.0-rc.3
npm install --save-dev vite@8
```

Create `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My first annotation</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

Create `main.ts` next to it using the complete browser example below. Then run:

```bash
npx vite --host 127.0.0.1
```

Open the printed local URL. This project installs the **published npm package**,
not a link to this repository. To produce a static build, run `npx vite build`;
`npx vite preview --host 127.0.0.1` serves that build for a local check.
Vite transforms TypeScript for the browser; it does not replace a separate
TypeScript typecheck in your application's CI.

## Use it in a browser application

In an existing TypeScript application whose bundler handles CSS imports:

```bash
npm install @ponchia/annotations@0.7.0-rc.3
```

Put this in a browser entry point that runs after the document body exists:

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

You should see one SVG annotation with the title **Peak response** and its
connector. This deliberately small example does not render a chart; the point
coordinates are the geometry your chart would supply. The CSS import styles the
output but does not install or require BrontoUI. The container keeps the same
aspect ratio as the 400 × 240 coordinate space and scales down on narrow screens.
In an existing application, mount it inside your own surface rather than
appending a second overlay to the document body.

`renderAnnotationsSvg` returns a complete SVG element. Do not put a complete
SVG overlay inside a chart's data group accidentally. Mount it in its own
container, or follow the layering pattern in the [SVG example](../examples/svg-basic/).
Keep the same `viewBox` coordinate system and `preserveAspectRatio` as the host.

## Use it in React

In an existing React application, install the annotation package:

```bash
npm install @ponchia/annotations@0.7.0-rc.3
```

React and React DOM remain peer dependencies: keep the application's existing
supported versions rather than installing another React copy. No D3, Vega,
Mermaid, or other host library is required for this component:

```tsx
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';

export function AnnotatedPoint() {
  return (
    <AnnotationLayer
      annotations={[{
        id: 'peak',
        anchor: { type: 'point', point: { x: 60, y: 120 } },
        note: { title: 'Peak response' },
        placement: { side: 'right' }
      }]}
      bounds={{ x: 0, y: 0, width: 400, height: 240 }}
      style={{ width: '100%', maxWidth: 640, height: 'auto', aspectRatio: '400 / 240' }}
      label="An annotated point"
      markerIdPrefix="react-first-annotation"
    />
  );
}
```

Render `<AnnotatedPoint />` from your application. `AnnotationLayer` creates
its own SVG and wrapper. The `style` above overrides the wrapper's default
fixed dimensions so this example scales within a narrow parent. For an overlay
on an existing chart, align its bounds and transform with the host; the [React example](../examples/react-basic/) includes that setup.

Start without editing or custom measurements. When you need them, read
[React rendering and editing](react-guide.md). The application owns the note
state; it decides when an edit becomes a persisted change.

To attach this first note to your existing surface, continue with the
[SVG, DOM report, or React Flow quickstart](context-quickstart.md). Each starts
with one target before introducing advanced diagnostics or editing.

## Coordinate and layout basics

`bounds`, anchors, obstacles, manual positions, and note sizes use one coordinate
space. A screen-pixel rectangle is not automatically a viewBox rectangle. Use the
[DOM or host adapter](context-quickstart.md) when measuring rendered content.

All note IDs must be stable and unique within a layer. Give independent layers
distinct `markerIdPrefix` values so their SVG connector definitions do not collide.

Automatic placement chooses among candidates. It cannot make unlimited text fit
a small viewport. Inspect `evaluateAnnotationLayout`, adjust placement options,
or reduce the visible notes when a layout is crowded. See the
[core guide](core-guide.md) and [troubleshooting](troubleshooting.md).

## Version and ownership boundaries

The website and repository examples follow `main`, which can be ahead of npm.
Match your installed version to its [release notes](https://github.com/Ponchia/bronto-annotations/releases).
The [compatibility](compatibility.md) and [API stability](api-stability.md) guides
separate tested support from experimental features.

Chart rendering, graph layout, selection state, undo/redo, Worker lifetime,
serialization validation, and persistence belong to the host application.
The examples demonstrate these integration choices; they do not add them to
the package's public API.
