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
  | { type: 'resolve'; id: number; baseRevision: number; options: LayoutOptions; delayMs?: number; forceSnapshot?: boolean }
  | { type: 'ack'; revision: number };
type Reply =
  | { type: 'ready' }
  | {
    type: 'resolved'; id: number; response: LayoutResponse; resolverMs: number;
    encodeMs: number; jsonWireBytes: number; jsonFullBytes: number;
  }
  | { type: 'error'; id: number; message: string };

let acknowledged: LayoutRevision | undefined;
const pendingLayouts = new Map<number, ResolvedLayout>();
function publish(value: Reply) { self.postMessage(value); }
function jsonBytes(value: unknown): number {
  try { return new Blob([JSON.stringify(value)]).size; }
  catch { return -1; } // Host metadata may be structured-cloneable but not JSON-safe.
}

self.addEventListener('message', (event: MessageEvent<Request>) => {
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
    for (const id of pendingLayouts.keys()) {
      if (id <= data.revision) pendingLayouts.delete(id);
    }
    return;
  }
  if (data?.type !== 'resolve' || !Number.isSafeInteger(data.id)
    || data.id < 1 || !Number.isSafeInteger(data.baseRevision)
    || data.baseRevision < 0 || data.baseRevision >= data.id
    || !data.options || !Array.isArray(data.options.annotations)
    || !data.options.bounds) return;

  const calculate = () => {
    try {
      const started = performance.now();
      const layout = resolveAnnotationLayout(data.options);
      const resolverMs = performance.now() - started;
      const encodeStarted = performance.now();
      const response = encodeWorkerLayout(data.id, data.baseRevision, layout,
        data.forceSnapshot ? undefined : acknowledged);
      const jsonWireBytes = jsonBytes(response);
      const jsonFullBytes = jsonBytes(layout);
      const encodeMs = performance.now() - encodeStarted;
      pendingLayouts.set(data.id, layout);
      // Cap outstanding reply snapshots: a consumer may cancel many requests
      // and never acknowledge those versions.
      while (pendingLayouts.size > 16) pendingLayouts.delete(pendingLayouts.keys().next().value!);
      publish({ type: 'resolved', id: data.id, response, resolverMs, encodeMs, jsonWireBytes, jsonFullBytes });
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
