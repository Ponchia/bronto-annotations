# Your first annotation

[Documentation index](README.md) · [Choose an adapter](context-quickstart.md)

Your application supplies an anchor, the engine places a note, and a renderer
displays it. This guide starts with one point in a new browser project.

## Choose your version

The tutorial installs published **0.9.1**. The website and repository examples
track `main`; use the [tagged API reference](https://github.com/Ponchia/bronto-annotations/blob/v0.9.1/docs/api-reference.md)
for this release or the [0.7 guide](https://github.com/Ponchia/bronto-annotations/blob/v0.7.0/docs/getting-started.md)
for older applications. Read the [migration guide](migration-0.7.md) when
upgrading from 0.6.

## Start a new application without cloning this repository

Use Node 22.12.0 or newer (see [compatibility](compatibility.md)):

```bash
mkdir annotation-demo
cd annotation-demo
npm init -y
npm install @ponchia/annotations@0.9.1
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

## Use it in a browser application

Create `main.ts` next to `index.html`. In an existing TypeScript app with CSS
imports, use an entry point that runs after the document body exists:

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

Run `npx vite --host 127.0.0.1` and open the printed URL. You should see a
**Peak response** note and connector. Stop the server with Ctrl+C.
The point coordinates stand in for your chart's geometry. The CSS import styles
the output without requiring BrontoUI, and the container scales to narrow screens.

Run `npx vite build` for a static build and `npx vite preview --host 127.0.0.1`
to preview it. Vite transforms TypeScript; add a separate type check to your
app's CI.

`renderAnnotationsSvg` returns a complete SVG element. For an existing chart,
follow the [SVG example's layering pattern](../examples/svg-basic/) and match
the host's `viewBox` and `preserveAspectRatio`.

## Use it in React

Use the same package install in an existing React application. Keep its supported
`react` and `react-dom` peer dependencies. This component needs no chart library:

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

Render `<AnnotatedPoint />` from your application. It creates an SVG and wrapper;
the style makes the wrapper responsive. The [React example](../examples/react-basic/)
shows alignment with a host chart. Continue with [rendering and editing](react-guide.md)
when you need measurements or edit callbacks; your app owns note state and persistence.

## Coordinate and layout basics

`bounds`, anchors, obstacles, manual positions, and note sizes use one coordinate
space. A screen-pixel rectangle is not automatically a `viewBox` rectangle.
Use the [DOM or host adapter](context-quickstart.md) when measuring rendered content.

All note IDs must be stable and unique within a layer. Give independent layers
distinct `markerIdPrefix` values so their SVG connector definitions do not collide.

Automatic placement chooses among candidates. It cannot make unlimited text fit
a small viewport. Inspect `evaluateAnnotationLayout`, adjust placement options,
or reduce the visible notes when a layout is crowded. See the
[core guide](core-guide.md) and [troubleshooting](troubleshooting.md).

## Version and ownership boundaries

See [API stability](api-stability.md) before adopting experimental features.
Chart rendering, graph layout, selection, undo/redo, Worker lifetime, and
persistence belong to your application.

## Try the existing examples

The [example catalog](../examples/README.md) has clone-and-run instructions for
complete host integrations. To connect your own surface, start with one note on
an [SVG figure](context-quickstart.md#first-note-on-a-figure),
[DOM report](context-quickstart.md#first-note-on-a-report), or
[React Flow graph](context-quickstart.md#first-note-on-a-graph).
