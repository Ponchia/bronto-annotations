import { resolveAnnotationLayout } from '@ponchia/annotations';
import type { LayoutOptions, ResolvedLayout } from '@ponchia/annotations';

// The consumer owns the Worker, protocol and lifecycle. There is no Worker
// service or application-state manager in @ponchia/annotations itself.
type Request = { id: number; options: LayoutOptions; delayMs?: number };
type Reply =
  | { kind: 'ready' }
  | { kind: 'resolved'; id: number; layout: ResolvedLayout; resolverMs: number }
  | { kind: 'error'; id: number; error: string };

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, options, delayMs = 0 } = event.data;
  const calculate = () => {
    try {
      const started = performance.now();
      const layout = resolveAnnotationLayout(options);
      self.postMessage({ kind: 'resolved', id, layout, resolverMs: performance.now() - started } satisfies Reply);
    } catch (error) {
      self.postMessage({ kind: 'error', id, error: error instanceof Error ? error.message : String(error) } satisfies Reply);
    }
  };
  // A delay makes out-of-order admission observable, not a faster benchmark.
  if (delayMs > 0) setTimeout(calculate, delayMs);
  else calculate();
});
self.postMessage({ kind: 'ready' } satisfies Reply);
