# Off-main-thread annotation layouts

This guide describes a **tested integration recipe**, not a public Worker
constructor or a new package export. Hosts can move expensive full annotation
layout calculations off the main thread using native module Web Workers while
continuing to use the same synchronous headless API inside the Worker.

## When to use a Worker

For a committed edit late in priority order, start with
`createIncrementalAnnotationLayoutSession`: it often reuses most resolved notes
without any worker overhead. For dense graph changes that invalidate many
placements, a full `resolveAnnotationLayout` may be expensive enough to block
React's main thread. A host-owned Worker can handle that calculation without
moving React, the SVG layer, or persistence into the Worker.

You can also try the [public interactive Worker demo](../examples/react-worker/)
and inspect its compact [host source](https://github.com/Ponchia/bronto-annotations/tree/main/examples/react-worker).
It demonstrates main-thread pings, superseded requests and cancellation with a
host-owned module Worker; its extra delay makes revision handling visible and
is **not** a solver benchmark.

The complete Vite + React test reference is in
[`test/fixtures/worker-browser`](https://github.com/Ponchia/bronto-annotations/tree/main/test/fixtures/worker-browser).
It is verified in **real Chromium** at desktop and mobile viewports, and has
an optional 200-annotation stress case. No `@ponchia/annotations` runtime
Worker dependency is required.

## Create the Worker in your host

Use the normal module Worker form. Vite [recognizes a direct constructor with a
static URL](https://vite.dev/guide/features.html#web-workers), and bundles the
Worker separately for production:

```ts
const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), {
  type: 'module'
});
```

A host-owned `layout.worker.ts` can import the ordinary package root:

```ts
import { resolveAnnotationLayout } from '@ponchia/annotations';
import type { LayoutOptions } from '@ponchia/annotations';

self.addEventListener('message', (event: MessageEvent<{
  id: number;
  options: LayoutOptions;
}>) => {
  const { id, options } = event.data;
  try {
    self.postMessage({ id, layout: resolveAnnotationLayout(options) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
```

The host controls the request revision and updates React only if the reply is
still current. `AnnotationLayer.resolvedLayout` accepts the authoritative
result, so it does **not** invoke another full solver:

```ts
let latestId = 0;
const requestLayout = (options: LayoutOptions) => {
  worker.postMessage({ id: ++latestId, options });
};
worker.addEventListener('message', (event) => {
  if (event.data.id !== latestId) return; // stale result: ignore it
  if (event.data.error) throw new Error(event.data.error);
  setResolvedLayout(event.data.layout); // host-managed React state
});
```

When using `resolvedLayout`, pass matching source annotations, bounds and
explicit note sizes. The React component cannot run its own DOM measurement
in this mode. Keep UI state, host graph changes, persistence and quality-report
preferences in the host app.

## Stale results, cancellation and identity

A Worker is a separate computation context. Old results may arrive after
newer ones, so revision checks are **required**. Ignoring an obsolete result
prevents it from overwriting the current layout. A cancelled host request can
similarly advance the latest request ID, but this **does not interrupt a
synchronous layout calculation already running inside the Worker**. To stop
that CPU work, terminate and recreate the Worker, accounting for startup cost.

`postMessage` also uses structured cloning. Pass cloneable annotation and
layout data: functions, DOM nodes, and other non-cloneable host values cannot
be transferred. A Worker reply is a new object graph, even if a stable note's
geometry is unchanged. For React memoization, the reference fixture checks
unchanged `ResolvedAnnotation` entries by value and reuses the prior objects
only on exact equivalence. Hosts may use a different structural-sharing
strategy as long as unchanged identities never conceal changed values.

## Actual browser validation

Run the mandatory mobile and desktop smoke without timing thresholds:

```bash
npm run test:browser:worker
```

For an additional 200-annotation case:

```bash
npm run benchmark:browser:worker
```

The browser tests verify an independent synchronous full-resolution parity
check after every accepted result, React SVG note counts, main-thread clicks
while Worker tasks are outstanding, deliberately out-of-order replies,
request cancellation, and the absence of browser errors. A delayed old reply
must never overwrite a newer layout. The Node 22 CI lane also runs a
**production Vite build and Chromium replay**, verifying that the module Worker
is emitted as a separate hashed JavaScript asset, not only supported by the
development server.

One development-host run, using the same source and layout options in Worker
and synchronous parity checks, measured:

| Browser case | Worker full solve | Request to next rAF callback | Unchanged resolved notes |
| --- | ---: | ---: | ---: |
| Desktop, 40 notes | 113 ms | 288 ms | 39/40 |
| Mobile, 24 notes | 63 ms | 155 ms | 23/24 |
| Dense desktop, 200 notes | 382 ms | 1,080 ms | 199/200 |

The 200-note test also verified that an unrelated main-thread button remained
interactive *while* the Worker was computing. These are single-run values on a
shared ARM64 development machine, not timing bounds. The interval includes
structured clone/transport, browser scheduling, React rendering and commit
costs. **A Worker avoids blocking the main thread with solver CPU work, but
serializing and reconciling 200 fully resolved notes can still be expensive.**
This motivates testing revisioned incremental/delta transport before shipping
a general-purpose Worker API. Neither time-to-next-rAF nor `workerElapsedMs` is
a compositor paint measurement, and no 60 fps claim follows from the results.

The package's synchronous and incremental core APIs remain fully usable
without Web Workers, in Node, SSR, and headless consumers. This proof will
inform whether a reusable experimental Worker bridge is justified in a future
version rather than expanding public API stability prematurely.
