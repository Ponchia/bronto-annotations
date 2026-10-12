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

The **published** example is also exercised by `npm run test:site`, not just
by the generated page's accessibility audit. At both mobile and desktop
widths, the browser test waits for a real module Worker to start, commits a
changed anchor and obstacle, supersedes a slow request, verifies that a
cancelled reply never commits, and pings the main thread while the Worker is
busy. Each accepted revision is compared with an independent full layout and
must produce no runtime/Worker errors. The mobile test additionally checks
that the diagram remains horizontally scrollable. This is functional proof,
not a latency or sustained frame-rate assertion.

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

## Reuse inside the Worker

The real Chromium Worker reference in `test/fixtures/worker-browser/` now
owns a private `createIncrementalAnnotationLayoutSession`. It receives complete
host-authored options with every revision. Unchanged priority prefixes and
spatially independent obstacles can therefore retain the *same immutable*
`ResolvedAnnotation` objects across solves. The compact response codec first
checks those object identities before examining an unchanged candidate graph
by value. This avoids redundant full solves **and** large deep comparisons for
incremental cases where the core has already proved reuse.

The very first request, globally invalidated layouts and iterative refinement
still require full resolution. The session is a speculative computational
cache only: cancelled or superseded requests never advance the host's accepted
revision. Receiving a later complete input snapshot reestablishes the correct
layout independently of any unacknowledged worker calculation.

This is an experimental host recipe, not a public package-owned Worker API,
and object-identity shortcuts assume the returned resolved layouts are not
mutated in place. Browser parity, rejection of obsolete replies and responsive
main-thread interactions remain required; benchmark timing is illustrative,
not a 60 fps guarantee.

## Compact revisioned Worker replies (host-owned example)

A Worker can finish a dense solve quickly yet still block its host while it
copies a complete array of candidate placements and connector paths into a
`postMessage` reply. The tested consumer example now includes a conservative
**revisioned compact response protocol** in
`test/fixtures/worker-browser/layout-patch.ts` and its Worker/React host.
This is **not** a public annotations API: the host still owns Worker creation,
state, scheduling and cancellation. The synchronous library API is unchanged.

1. The first result is a **snapshot**. The Worker retains its resolved result
   but does not trust it as a shared baseline until the host explicitly ACKs
   the accepted revision.
2. Later results may be **patches** carrying `baseRevision`, an ordered list of
   changed annotation indices/values, and authoritative global geometry
   (`bounds`, `placementBounds`, `padding`, `obstacles`). Unchanged resolved
   annotations retain the existing host object identities.
3. Only an exact acknowledged `baseRevision` can be patched. A mismatched
   revision, changed annotation count/order, or dense change set produces a
   complete snapshot instead. The host rejects stale IDs, duplicate/out-of-
   bounds patch indices and changed annotation IDs, and requests a full
   snapshot once if its baseline unexpectedly diverges.
4. Superseded or cancelled Worker replies are **not ACKed**, so they cannot
   silently advance the patch baseline. Acknowledgement itself does not stop
   synchronous Worker CPU; cancellation remains a host-level decision.

The public React Worker demo now uses the same conservative deep comparator
as the compact transport fixture, rather than `JSON.stringify` equality.
Both paths also check cross-annotation sharing in host-owned source data:
if shared references split/join, or one member of a shared group changes,
the entire Worker result is installed instead of mixing new objects with old
siblings. Unsupported metadata causes safe non-reuse without calling getters.
This improves correctness but does **not** speed up deep comparison and does
not turn the experimental patch protocol into a package export.

The comparison checks plain structured-cloneable data *by value*, including
own keys and `undefined`. It also checks the **topology of shared references**:
if two metadata properties formerly referred to the same object but now hold
independent equal-looking copies (or vice versa), the annotation is treated
as changed. Equivalent structured-cloned objects with the same sharing pattern
remain eligible for reuse, including the natural aliases in resolved geometry.
Non-plain/cyclic metadata is conservatively treated as changed instead of
retaining a stale React node. A malformed patch or missing layout fields must
raise a revision mismatch so the host can request an authoritative snapshot,
not crash with a generic property-access error. The host must not mutate
previously resolved layout objects in place. Global changes are
carried in every patch and all reconstructed results are still compared
against an independent fresh full resolution in Chromium.

The mandatory desktop/mobile test proves that an acknowledged far-obstacle
update uses a compact patch, and deliberately stale/cancelled replies are
ignored. The optional 200-note case reports the same evidence without timing
budgets. `jsonWireBytes` estimates serialized compact reply size, while
`jsonFullBytes` uses an **actual full-layout JSON measurement for the first
snapshot** and a cached acknowledged full-size estimate on subsequent patches.
This avoids serializing a multi-megabyte unchanged layout simply for profiling.
Neither field measures actual browser structured-clone transport bytes.

### Worker transport and React timeline

The Chromium host/Worker fixture now samples `performance.timeOrigin +
performance.now()` in **both contexts** at request dispatch, first Worker
message receipt, Worker solver start, Worker reply dispatch, and the first host
message callback. The resulting measurements distinguish additional delays
outside the solver:

| Metric | Meaning | Important qualification |
| --- | --- | --- |
| `postMessageMs` | Host synchronous `worker.postMessage` call duration | Includes some synchronous clone/dispatch overhead; not network transit |
| `requestDeliveryMs` | Host dispatch → first Worker message callback | Includes browser clone, queue and Worker scheduling; cross-context clock estimate |
| `workerQueueMs` | Worker callback → actual solve start | Includes any fixture-only delayed-resolution timer; not solver CPU |
| `resolverMs` | Synchronous core layout solve inside Worker | Solver CPU, not the complete response time |
| `encodeMs` | Compute compact patch vs full snapshot + JSON size estimate | JSON size is not actual structured-clone bytes |
| `responseDeliveryMs` | Worker reply dispatch → host message callback | Includes reply cloning and main-thread event-loop scheduling |
| `admissionMs` | Host revision validation, patch assembly and structural sharing | Excludes React commit and browser paint |
| `reactRenderMs` | React Profiler `actualDuration` for annotation subtree | Development/profiling builds only; unavailable in standard React production builds |
| `reactCommitAfterReceiptMs` | Host reply callback entry → React `useLayoutEffect` after commit | Works in production and development; includes admission/React scheduling, not compositor paint |
| `rAFMs` | Host request dispatch → next recorded animation-frame callback | **Not** equivalent to actual paint or a stable frame-rate budget |

`requestDeliveryMs`, `workerQueueMs` and `responseDeliveryMs` use cross-context
epoch-relative timestamps, clamped at zero to absorb small time-origin skew.
They are approximate queue/delivery intervals, **not isolated structured-clone
costs**; the numbers should not be summed into an exact critical path because
some measurements overlap and are taken at different scheduling boundaries.
The tests assert existence and finite values in real Chromium desktop/mobile
and optional 200-note cases, with no timing ceilings on shared CI hardware.
Request supersession, cancellation and Worker ACK behavior remain unchanged.

An additional October 2026 ARM64 Chromium run exposed a more precise
optimization opportunity for **already acknowledged** compact replies:

| Fixture / 0-note-change obstacle update | Worker solve | Deep comparison + patch encoding | Reply delivery estimate | React commit after host receipt |
| --- | ---: | ---: | ---: | ---: |
| 24 notes (mobile) | 27 ms | 68 ms | 0.4 ms | 3.5 ms |
| 40 notes (desktop) | 68 ms | 113 ms | ~0 ms | 5.4 ms |
| 200 notes (dense desktop) | 272 ms | **489 ms** | 0.2 ms | 20 ms |

The dense case encoded a **298-byte estimated JSON patch** instead of a
~28 MB full JSON layout, yet spent far more time comparing candidate/connector
objects than transferring the compact response or committing the React tree.
A 200-note **initial snapshot** was different: ~219 ms response-delivery
estimate and ~505 ms host revision/structural-sharing admission because the
whole resolved graph had to cross the Worker boundary. These are single-run,
shared-machine observations—not a regression threshold or proof of exact
structured-clone costs. They motivate profiling/de-risking the conservative
`canReuseWorkerAnnotation` value/alias comparator before considering heavier
Worker scheduling or changing stable public annotation APIs.
Use browser Performance traces and real device tests before drawing
conclusions about compositor paint or 60 fps interaction.

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
