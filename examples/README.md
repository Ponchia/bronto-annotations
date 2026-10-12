# Runnable examples

[Package README](../README.md) · [First annotation](../docs/getting-started.md) ·
[Live example catalog](https://ponchia.github.io/bronto-annotations/examples/)

These are real host applications using public package imports, not independent
npm packages or screenshots of an imagined API. Start with **SVG figure** or
**React annotation layer**. The editor and Worker demos are advanced integration
recipes; their host-owned features are not added to the package API.

## Run one example

After cloning the repository, run commands from its root:

```bash
npm ci
npm run example -- examples/svg-basic
```

Open the local URL printed by Vite. Replace `svg-basic` with a directory from the
catalog below. To choose a port, add `--port 5174 --strictPort`. No account,
API key, or application backend is needed. The initial dependency install needs
network access. Use the Node versions in the [compatibility matrix](../docs/compatibility.md).

Changes inside an example are handled by Vite. Changes in `src/` require
rebuilding the package; restart the command above to build before serving again.

## Choose a surface

| Example | What it demonstrates | Open |
| --- | --- | --- |
| [SVG figure](svg-basic/README.md) | Host-rendered SVG with notes, subjects, connectors, and layout diagnostics. | [Live](https://ponchia.github.io/bronto-annotations/examples/svg-basic/) |
| [React annotation layer](react-basic/README.md) | A React-rendered workflow with a separate annotation SVG layer. | [Live](https://ponchia.github.io/bronto-annotations/examples/react-basic/) |
| [Interactive annotation editor](react-incremental/README.md) | Drag and edit notes, inspect JSON, and undo committed changes with host-owned history. | [Live](https://ponchia.github.io/bronto-annotations/examples/react-incremental/) |
| [Worker layout experiment](react-worker/README.md) | Host-owned module Worker with revision-safe results and responsive UI controls. | [Live](https://ponchia.github.io/bronto-annotations/examples/react-worker/) |
| [React Flow diagram](react-flow-basic/README.md) | Callouts attached to public node, handle, edge, and viewport geometry. | [Live](https://ponchia.github.io/bronto-annotations/examples/react-flow-basic/) |
| [DOM regions](dom-basic/README.md) | Annotations attached to measured regions of an ordinary HTML surface. | [Live](https://ponchia.github.io/bronto-annotations/examples/dom-basic/) |
| [Vega and Vega-Lite](vega-basic/README.md) | Notes attached to rendered chart marks and geometry supplied by Vega. | [Live](https://ponchia.github.io/bronto-annotations/examples/vega-basic/) |
| [Mermaid diagrams](mermaid-basic/README.md) | Annotations on actual rendered Mermaid diagram geometry. | [Live](https://ponchia.github.io/bronto-annotations/examples/mermaid-basic/) |
| [D2 diagram](d2-basic/README.md) | Callouts on D2 compiled or rendered shape and connection geometry. | [Live](https://ponchia.github.io/bronto-annotations/examples/d2-basic/) |
| [Annotated report](bronto-report/README.md) | Annotations over report geometry with an optional Bronto styling bridge. | [Live](https://ponchia.github.io/bronto-annotations/examples/bronto-report/) |
| [Annotation styles](style-gallery/README.md) | A visual reference for callout variants and the optional annotation CSS. | [Live](https://ponchia.github.io/bronto-annotations/examples/style-gallery/) |
| [Visual example index](index/README.md) | An annotated overview with links to the individual demonstration surfaces. | [Live](https://ponchia.github.io/bronto-annotations/examples/index/) |

## Verify or browse the whole collection

```bash
npm run test:examples
npm run site:build
```

`test:examples` compiles each fixture. `site:build` creates `_site/`, including
all examples and the documentation. Serve that directory with a static server;
for example, with Python 3 available:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory _site
```

Open `http://127.0.0.1:4173/examples/`. Use the full site for cross-example
navigation; a Vite server rooted at one example only serves that example.
Build output is ignored by Git and should not be committed.

## Report integration friction

Tell us which example you started from, the installed package and host versions,
and the smallest change that caused the problem. See [SUPPORT.md](../SUPPORT.md).
Avoid publishing private application data or credentials in a reproduction.
