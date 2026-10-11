/**
 * Consumer-owned Worker example. The headless package does not create any
 * worker or require browser APIs: this host opts in explicitly. Delayed test
 * requests are independent full resolutions so intentionally reordered
 * replies cannot corrupt an incremental session's authoritative state.
 */
import { resolveAnnotationLayout } from '@ponchia/annotations';
import type { LayoutOptions, ResolvedLayout } from '@ponchia/annotations';

type Request = {
  type: 'resolve';
  id: number;
  options: LayoutOptions;
  delayMs?: number;
};
type Reply =
  | { type: 'ready' }
  | { type: 'resolved'; id: number; layout: ResolvedLayout; resolverMs: number }
  | { type: 'error'; id: number; message: string };

function publish(value: Reply) { self.postMessage(value); }

self.addEventListener('message', (event: MessageEvent<Request>) => {
  // Dedicated Workers receive messages from their owning document (not
  // arbitrary cross-origin windows). Some implementations expose an empty
  // MessageEvent.origin for Worker.postMessage; if origin is provided, refuse
  // messages from a different origin. Check the request shape regardless.
  if (event.origin !== '' && event.origin !== self.origin) return;
  const data = event.data;
  if (data?.type !== 'resolve' || !Number.isSafeInteger(data.id)
    || data.id < 1 || !data.options || !Array.isArray(data.options.annotations)
    || !data.options.bounds) return;
  const calculate = () => {
    try {
      const start = performance.now();
      const layout = resolveAnnotationLayout(data.options);
      publish({ type: 'resolved', id: data.id, layout, resolverMs: performance.now() - start });
    } catch (error) {
      publish({ type: 'error', id: data.id, message: error instanceof Error ? error.message : String(error) });
    }
  };
  // Deliberate reordering in the test fixture proves that the host ignores
  // superseded responses. There is no claim this timer cancels CPU work.
  if (data.delayMs && data.delayMs > 0) setTimeout(calculate, data.delayMs);
  else calculate();
});

publish({ type: 'ready' });
