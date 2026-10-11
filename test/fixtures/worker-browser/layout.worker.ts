/**
 * Consumer-owned Worker reference. Full deterministic layouts are calculated
 * off the main thread; an acknowledged baseline allows revision-safe compact
 * replies instead of cloning the entire resolved annotation array every time.
 * It intentionally does not own persistence or application scheduling.
 */
import { resolveAnnotationLayout } from '@ponchia/annotations';
import type { LayoutOptions, ResolvedLayout } from '@ponchia/annotations';
import { encodeWorkerLayout } from './layout-patch.js';
import type { LayoutResponse, LayoutRevision } from './layout-patch.js';

type Request =
  | { type: 'resolve'; id: number; baseRevision: number; options: LayoutOptions; delayMs?: number; forceSnapshot?: boolean; hostSentEpochMs: number }
  | { type: 'ack'; revision: number };
type Reply =
  | { type: 'ready' }
  | {
    type: 'resolved'; id: number; response: LayoutResponse; resolverMs: number;
    encodeMs: number; jsonWireBytes: number; jsonFullBytes: number;
    workerReceivedEpochMs: number; workerSolveStartedEpochMs: number;
    workerReplySentEpochMs: number;
  }
  | { type: 'error'; id: number; message: string };

let acknowledged: LayoutRevision | undefined;
// The first snapshot provides an actual full-layout JSON measurement. Later
// compact responses reuse that acknowledged baseline as an *estimate*, not an
// exact byte count. Serializing the entire 200-note layout for every patch
// defeats the point of compact Worker transport.
let acknowledgedFullJSONBytes = -1;
const pendingLayouts = new Map<number, ResolvedLayout>();
const pendingFullJSONBytes = new Map<number, number>();
function publish(value: Reply) { self.postMessage(value); }
function jsonBytes(value: unknown): number {
  try { return new Blob([JSON.stringify(value)]).size; }
  catch { return -1; } // Host metadata may be structured-cloneable but not JSON-safe.
}

self.addEventListener('message', (event: MessageEvent<Request>) => {
  // Use the shared Unix-epoch-relative Performance API timeline to estimate
  // cross-context delays. This is a transport/queue observation, *not* a
  // structured-clone byte counter or a compositor paint measurement.
  const workerReceivedEpochMs = performance.timeOrigin + performance.now();
  // Dedicated Workers receive messages from their owning document (not
  // arbitrary cross-origin windows). Some implementations expose an empty
  // MessageEvent.origin for Worker.postMessage; reject foreign origins.
  if (event.origin !== '' && event.origin !== self.origin) return;
  const data = event.data;
  if (data?.type === 'ack') {
    if (!Number.isSafeInteger(data.revision) || data.revision < 1
      || (acknowledged && data.revision <= acknowledged.revision)) return;
    const layout = pendingLayouts.get(data.revision);
    if (!layout) return;
    acknowledged = { revision: data.revision, layout };
    acknowledgedFullJSONBytes = pendingFullJSONBytes.get(data.revision) ?? -1;
    for (const id of pendingLayouts.keys()) {
      if (id <= data.revision) {
        pendingLayouts.delete(id);
        pendingFullJSONBytes.delete(id);
      }
    }
    return;
  }
  if (data?.type !== 'resolve' || !Number.isSafeInteger(data.id)
    || data.id < 1 || !Number.isSafeInteger(data.baseRevision)
    || data.baseRevision < 0 || data.baseRevision >= data.id
    || !Number.isFinite(data.hostSentEpochMs) || data.hostSentEpochMs <= 0
    || !data.options || !Array.isArray(data.options.annotations)
    || !data.options.bounds) return;

  const calculate = () => {
    try {
      const workerSolveStartedEpochMs = performance.timeOrigin + performance.now();
      const started = performance.now();
      const layout = resolveAnnotationLayout(data.options);
      const resolverMs = performance.now() - started;
      const encodeStarted = performance.now();
      const response = encodeWorkerLayout(data.id, data.baseRevision, layout,
        data.forceSnapshot ? undefined : acknowledged);
      const jsonWireBytes = jsonBytes(response);
      // Exact only on snapshot/bootstrap. On patches use the previously
      // acknowledged full size as an explicitly approximate comparison.
      const jsonFullBytes = response.kind === 'snapshot' || acknowledgedFullJSONBytes <= 0
        ? jsonBytes(layout)
        : acknowledgedFullJSONBytes;
      const encodeMs = performance.now() - encodeStarted;
      pendingLayouts.set(data.id, layout);
      pendingFullJSONBytes.set(data.id, jsonFullBytes);
      // Cap outstanding reply snapshots: a consumer may cancel many requests
      // and never acknowledge those versions.
      while (pendingLayouts.size > 16) {
        const expired = pendingLayouts.keys().next().value!;
        pendingLayouts.delete(expired);
        pendingFullJSONBytes.delete(expired);
      }
      // Sample immediately before postMessage. The host measures receipt on
      // entry to its listener; this interval includes cloning, delivery and
      // main-thread scheduling, and must never be sold as pure clone time.
      const workerReplySentEpochMs = performance.timeOrigin + performance.now();
      publish({ type: 'resolved', id: data.id, response, resolverMs, encodeMs,
        jsonWireBytes, jsonFullBytes, workerReceivedEpochMs,
        workerSolveStartedEpochMs, workerReplySentEpochMs });
    } catch (error) {
      publish({ type: 'error', id: data.id, message: error instanceof Error ? error.message : String(error) });
    }
  };
  // Test-only delayed resolutions prove that out-of-order messages never
  // overwrite the latest accepted revision. Delays do not cancel Worker CPU.
  if (data.delayMs && data.delayMs > 0) setTimeout(calculate, data.delayMs);
  else calculate();
});

publish({ type: 'ready' });
