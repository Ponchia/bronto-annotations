import { Profiler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnnotationLayer } from '@ponchia/annotations/react';
import { resolveAnnotationLayout } from '@ponchia/annotations';
import type { Annotation, Box, LayoutOptions, ResolvedAnnotation, ResolvedLayout } from '@ponchia/annotations';
import { applyWorkerLayout, canReuseWorkerAnnotation, LayoutRevisionMismatchError } from './layout-patch.js';
import type { LayoutResponse } from './layout-patch.js';
import '@ponchia/annotations/bronto.css';

const count = Number(new URLSearchParams(location.search).get('count')) || 40;
const bounds: Box = { x: 0, y: 0, width: 1700, height: 1400 };
const farObstacle: Box = { x: 1430, y: 1130, width: 60, height: 50 };

function makeAnnotation(index: number): Annotation {
  return {
    id: `node-${String(index).padStart(3, '0')}`,
    priority: count - index,
    anchor: { type: 'point', point: { x: 65 + index % 13 * 96, y: 75 + Math.floor(index / 13) * 79 } },
    note: { title: `Node ${index}` },
    placement: { side: 'right', offset: [12, 24], align: 'center' },
    connector: { type: 'straight', routing: 'none' }
  };
}

const initialAnnotations = Array.from({ length: count }, (_, i) => makeAnnotation(i));
const noteSizes = Object.fromEntries(initialAnnotations.map((item) => [item.id, { width: 84, height: 38 }]));
const baseOptions: Omit<LayoutOptions, 'annotations' | 'obstacles'> = {
  bounds, noteSizes, refinement: false
};
const initialOptions: LayoutOptions = {
  ...baseOptions, annotations: initialAnnotations, obstacles: [farObstacle]
};
const initialLayout = resolveAnnotationLayout(initialOptions);

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
type Observation = {
  id: number;
  action: string;
  resolverMs: number;
  workerElapsedMs: number;
  noteCount?: number;
  rAFMs?: number;
  reused: number;
  changed: number;
  transport: 'snapshot' | 'patch';
  jsonWireBytes: number;
  jsonFullBytes: number;
  encodeMs: number;
  postMessageMs: number;
  admissionMs: number;
  // Cross-context epoch estimates. requestDelivery also includes queueing;
  // responseDelivery also includes browser event-loop scheduling. Neither is
  // an exact measure of structured-clone time or compositor paint.
  requestDeliveryMs: number;
  workerQueueMs: number;
  responseDeliveryMs: number;
  reactRenderMs?: number;
  reactCommitAfterReceiptMs?: number;
  uiPingsAtCommit: number;
};
type Probe = {
  ready: boolean;
  events: Observation[];
  dropped: number;
  errors: string[];
  pings: number;
  pendingId: number | null;
  lastLayout: ResolvedLayout;
  checkParity: () => boolean;
};
declare global { interface Window { __workerProof?: Probe; } }

function shareUnchanged(previous: ResolvedLayout, fresh: ResolvedLayout) {
  const prior = new Map(previous.annotations.map((item) => [item.id, item]));
  let reused = 0;
  const annotations = fresh.annotations.map((item): ResolvedAnnotation => {
    const last = prior.get(item.id);
    // The optional host metadata may be structured-cloneable without being
    // JSON-serializable (for example cyclic objects or BigInt). If value
    // comparison is unavailable, keep the fresh worker result rather than
    // hiding a change behind an incorrectly reused React object.
    const equivalent = last ? canReuseWorkerAnnotation(last, item) : false;
    if (last && equivalent) {
      reused += 1;
      return last;
    }
    return item;
  });
  return { layout: { ...fresh, annotations }, reused };
}

function App() {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [obstacles, setObstacles] = useState<Box[]>([farObstacle]);
  const [layout, setLayout] = useState(initialLayout);
  const [status, setStatus] = useState('Starting worker');
  const [pings, setPings] = useState(0);
  const worker = useRef<Worker | null>(null);
  const latestId = useRef(0);
  const committedRevision = useRef(0);
  const active = useRef<{
    id: number; action: string; options: LayoutOptions; sentAt: number;
    sentEpochMs: number; uiPingsAtStart: number;
    forceSnapshot: boolean; postMessageMs: number
  } | null>(null);
  const committed = useRef<LayoutOptions>(initialOptions);
  const resolved = useRef(initialLayout);
  const pingCount = useRef(0);
  const latestReactRenderMs = useRef(0);
  const pendingReactCommit = useRef<{
    observation: Observation; acceptedAt: number;
  } | null>(null);
  const observations = useRef<Observation[]>([]);
  // React's Profiler onRender is not guaranteed in production builds. A host
  // layout effect runs after React commits in both dev and production, making
  // this the correct boundary for a verified commit delay signal.
  useLayoutEffect(() => {
    const pending = pendingReactCommit.current;
    if (pending) {
      pending.observation.reactCommitAfterReceiptMs =
        Math.max(0, performance.now() - pending.acceptedAt);
      pendingReactCommit.current = null;
    }
  }, [layout]);
  const dropped = useRef(0);
  const errors = useRef<string[]>([]);

  // Browser integration proof only: the worker is created by this consumer,
  // using the native Vite-supported direct Worker(new URL()) module syntax.
  useEffect(() => {
    const instance = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.addEventListener('message', (event: MessageEvent<Reply>) => {
      const hostReplyReceivedAt = performance.now();
      const hostReplyReceivedEpochMs = performance.timeOrigin + hostReplyReceivedAt;
      // Browser Worker events may have an empty serialized origin. A dedicated
      // Worker is bound to its creator; reject a reported foreign origin.
      if (event.origin !== '' && event.origin !== window.location.origin) return;
      const message = event.data;
      if (message.type === 'ready') {
        window.__workerProof!.ready = true;
        setStatus('Worker ready');
        return;
      }
      if (message.id !== latestId.current || active.current?.id !== message.id) {
        dropped.current += 1;
        window.__workerProof!.dropped = dropped.current;
        return;
      }
      if (message.type === 'error') {
        errors.current.push(message.message);
        window.__workerProof!.errors = [...errors.current];
        setStatus(`Error: ${message.message}`);
        active.current = null;
        window.__workerProof!.pendingId = null;
        return;
      }
      const pending = active.current;
      let assembled: ResolvedLayout;
      let reused: number;
      let changed: number;
      const admissionStarted = performance.now();
      try {
        const result = applyWorkerLayout(
          { revision: committedRevision.current, layout: resolved.current }, message.response);
        if (message.response.kind === 'snapshot') {
          const shared = shareUnchanged(resolved.current, result.state.layout);
          assembled = shared.layout;
          reused = shared.reused;
          changed = assembled.annotations.length - reused;
        } else {
          assembled = result.state.layout;
          reused = result.reused;
          changed = result.changed;
        }
      } catch (error) {
        // A baseline divergence must never patch the wrong layout. Recompute a
        // complete snapshot once, without taking an unsafe stale short-cut.
        if (error instanceof LayoutRevisionMismatchError && !pending.forceSnapshot) {
          send(pending.action, pending.options, 0, true);
        } else {
          errors.current.push(error instanceof Error ? error.message : String(error));
          window.__workerProof!.errors = [...errors.current];
          active.current = null;
          window.__workerProof!.pendingId = null;
        }
        return;
      }
      const admissionMs = performance.now() - admissionStarted;
      resolved.current = assembled;
      committedRevision.current = message.id;
      // Only accepted responses advance the Worker's acknowledged baseline;
      // cancelled, superseded or invalid messages receive no ACK.
      worker.current?.postMessage({ type: 'ack', revision: message.id } satisfies Request);
      committed.current = pending.options;
      setAnnotations(pending.options.annotations);
      setObstacles(pending.options.obstacles ?? []);
      setLayout(assembled);
      setStatus(`${pending.action}: ${reused}/${assembled.annotations.length} notes retained`);
      const recorded: Observation = {
        id: message.id,
        action: pending.action,
        resolverMs: message.resolverMs,
        workerElapsedMs: performance.now() - pending.sentAt,
        reused,
        changed,
        transport: message.response.kind,
        jsonWireBytes: message.jsonWireBytes,
        jsonFullBytes: message.jsonFullBytes,
        encodeMs: message.encodeMs,
        postMessageMs: pending.postMessageMs,
        admissionMs,
        // Clamp tiny clock-origin skew between Worker and document. The raw
        // intervals include dispatch, cloning and event-loop waits; they are
        // deliberately not labelled pure serialization/clone costs.
        requestDeliveryMs: Math.max(0, message.workerReceivedEpochMs - pending.sentEpochMs),
        workerQueueMs: Math.max(0,
          message.workerSolveStartedEpochMs - message.workerReceivedEpochMs),
        responseDeliveryMs: Math.max(0,
          hostReplyReceivedEpochMs - message.workerReplySentEpochMs),
        uiPingsAtCommit: pingCount.current - pending.uiPingsAtStart
      };
      observations.current.push(recorded);
      pendingReactCommit.current = { observation: recorded, acceptedAt: hostReplyReceivedAt };
      window.__workerProof!.events = observations.current;
      window.__workerProof!.lastLayout = assembled;
      active.current = null;
      window.__workerProof!.pendingId = null;
      requestAnimationFrame(() => {
        recorded.rAFMs = performance.now() - pending.sentAt;
        recorded.noteCount = document.querySelectorAll('g.pa-annotation').length;
      });
    });
    instance.addEventListener('error', (event) => {
      errors.current.push(event.message);
      window.__workerProof!.errors = [...errors.current];
    });
    return () => {
      latestId.current += 1;
      instance.terminate();
      worker.current = null;
    };
  }, []);

  function send(action: string, next: LayoutOptions, delayMs = 0, forceSnapshot = false) {
    if (!worker.current) throw new Error('Worker is not ready');
    const id = ++latestId.current;
    const sentAt = performance.now();
    const sentEpochMs = performance.timeOrigin + sentAt;
    active.current = { id, action, options: next, sentAt, sentEpochMs,
      uiPingsAtStart: pingCount.current, forceSnapshot, postMessageMs: 0 };
    window.__workerProof!.pendingId = id;
    setStatus(`Computing ${action} in Worker`);
    const request: Request = { type: 'resolve', id, baseRevision: committedRevision.current,
      options: next, delayMs, forceSnapshot, hostSentEpochMs: sentEpochMs };
    const beforeClone = performance.now();
    worker.current.postMessage(request);
    if (active.current?.id === id) active.current.postMessageMs = performance.now() - beforeClone;
  }

  function moveAnchor() {
    const next = structuredClone(committed.current);
    const last = next.annotations.at(-1)!;
    if (last.anchor.type !== 'point') throw new Error('Point anchor expected');
    last.anchor.point.x += 20;
    last.note.title = `Worker edit ${latestId.current + 1}`;
    send('anchor', next);
  }
  function moveGlobalObstacle() {
    const next = structuredClone(committed.current);
    const old = next.obstacles?.[0] ?? farObstacle;
    next.obstacles = [{ ...old, x: old.x - 25 }];
    send('obstacle', next);
  }
  function burst() {
    const old = structuredClone(committed.current);
    const fresh = structuredClone(committed.current);
    const last = fresh.annotations.at(-1)!;
    last.note.title = `Latest burst ${latestId.current + 2}`;
    send('stale-request', old, 160);
    send('newest-request', fresh, 0);
  }
  function delayed() { send('delayed-request', structuredClone(committed.current), 160); }
  function cancel() {
    latestId.current += 1;
    active.current = null;
    window.__workerProof!.pendingId = null;
    setStatus('Cancelled request; existing layout retained');
  }
  function ping() {
    pingCount.current += 1;
    window.__workerProof!.pings = pingCount.current;
    setPings(pingCount.current);
  }

  const verifyParity = useCallback(() => {
    const fresh = resolveAnnotationLayout(committed.current);
    // Compact patches can preserve the same values while rebuilding an
    // object with a different property insertion order. Compare semantic
    // geometry and host metadata rather than JSON key order.
    return canReuseWorkerAnnotation(fresh, resolved.current);
  }, []);
  useEffect(() => {
    window.__workerProof = {
      ready: false, events: observations.current, dropped: 0, errors: [],
      pings: 0, pendingId: null, lastLayout: initialLayout, checkParity: verifyParity
    };
  }, [verifyParity]);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 12 }}>
      <h1 style={{ fontSize: 20 }}>Off-main-thread annotation layout proof</h1>
      <p role="status" id="worker-status" aria-live="polite">{status}</p>
      <nav aria-label="Worker test controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button id="worker-anchor" onClick={moveAnchor}>Move latest anchor in Worker</button>
        <button id="worker-obstacle" onClick={moveGlobalObstacle}>Move host obstacle in Worker</button>
        <button id="worker-burst" onClick={burst}>Issue superseded requests</button>
        <button id="worker-delay" onClick={delayed}>Start cancellable request</button>
        <button id="worker-cancel" onClick={cancel}>Ignore pending response</button>
        <button id="worker-ping" onClick={ping}>Check main thread</button>
      </nav>
      <span id="ping-count">UI pings: {pings}</span>
      <section aria-label="Annotated graph" style={{ position: 'relative', width: bounds.width, height: bounds.height }}>
        <svg role="img" aria-label="Example graph geometry" width={bounds.width} height={bounds.height} style={{ position: 'absolute', inset: 0 }}>
          {annotations.map((item) => {
            const p = item.anchor.type === 'point' ? item.anchor.point : { x: 0, y: 0 };
            return <rect key={item.id} x={p.x - 8} y={p.y - 8} width={16} height={16} fill="#64748b" />;
          })}
        </svg>
        <Profiler id="worker-annotation-layer" onRender={(_id, _phase, actualDuration) => {
          latestReactRenderMs.current = actualDuration;
          const pending = pendingReactCommit.current;
          // Profiler render duration may be unavailable in production.
          if (pending) pending.observation.reactRenderMs = actualDuration;
        }}>
          <AnnotationLayer
            annotations={annotations}
            bounds={bounds}
            obstacles={obstacles}
            noteSizes={noteSizes}
            resolvedLayout={layout}
            label="Worker-hosted annotation SVG layer"
          />
        </Profiler>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
