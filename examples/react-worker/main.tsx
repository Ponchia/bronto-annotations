import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  resolveAnnotationLayout,
  type Annotation,
  type Box,
  type LayoutOptions,
  type ResolvedAnnotation,
  type ResolvedLayout
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';
import './styles.css';

const count = 18;
const bounds: Box = { x: 0, y: 0, width: 1160, height: 600 };
const obstacles: Box[] = [
  { x: 130, y: 275, width: 100, height: 56 },
  { x: 480, y: 275, width: 100, height: 56 },
  { x: 830, y: 275, width: 100, height: 56 }
];
const initialAnnotations: Annotation[] = Array.from({ length: count }, (_, index) => ({
  id: `point-${String(index).padStart(2, '0')}`,
  priority: count - index,
  anchor: { type: 'point', point: {
    x: 60 + (index % 9) * 125,
    y: 185 + Math.floor(index / 9) * 235
  } },
  note: { title: `Signal ${index + 1}`, body: 'Worker result' },
  placement: { side: index % 2 === 0 ? 'top' : 'bottom', offset: [29, 48], align: 'center' },
  connector: { type: 'straight', routing: 'none' }
}));
const noteSizes = Object.fromEntries(initialAnnotations.map((a) => [a.id, { width: 106, height: 60 }]));
const initialOptions: LayoutOptions = {
  annotations: initialAnnotations,
  bounds,
  obstacles,
  noteSizes,
  refinement: false
};
const initialLayout = resolveAnnotationLayout(initialOptions);

type Request = { id: number; options: LayoutOptions; delayMs?: number };
type Reply =
  | { kind: 'ready' }
  | { kind: 'resolved'; id: number; layout: ResolvedLayout; resolverMs: number }
  | { kind: 'error'; id: number; error: string };
type View = {
  options: LayoutOptions;
  layout: ResolvedLayout;
  action: string;
  reused: number;
  commits: number;
  resolverMs: number;
};

declare global {
  interface Window {
    __annotationsExample?: {
      name: string;
      quality: ReturnType<typeof evaluateAnnotationLayout>;
      qualitySummary: string;
      obstacles: Box[] | undefined;
      annotations: Array<{ id: string; anchor: Annotation['anchor']; manual: unknown; noteBox: Box }>;
    };
    __annotationsWorkerDemo?: {
      ready: boolean;
      pending: boolean;
      commits: number;
      discarded: number;
      pings: number;
      lastAction: string;
      errors: string[];
      freshParity: () => boolean;
    };
  }
}

function shareUnchanged(before: ResolvedLayout, next: ResolvedLayout) {
  const previous = new Map(before.annotations.map((item) => [item.id, item]));
  let reused = 0;
  const annotations = next.annotations.map((item): ResolvedAnnotation => {
    const old = previous.get(item.id);
    // A Worker reply always has new object identities. Reuse a previous
    // annotation only when *all* serialized values match exactly. Unsupported
    // cyclic/BigInt host metadata conservatively keeps the new object.
    let equal = false;
    try { equal = Boolean(old && JSON.stringify(old) === JSON.stringify(item)); }
    catch { equal = false; }
    if (old && equal) { reused += 1; return old; }
    return item;
  });
  return { layout: { ...next, annotations }, reused };
}

function App() {
  const [view, setView] = useState<View>({
    options: initialOptions, layout: initialLayout, action: 'Initial annotation layout',
    reused: 0, commits: 0, resolverMs: 0
  });
  const [workerReady, setWorkerReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('Starting the layout Worker');
  const [pings, setPings] = useState(0);
  const [discarded, setDiscarded] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const latestRequest = useRef(0);
  const active = useRef<{ id: number; action: string; options: LayoutOptions } | null>(null);
  const committed = useRef(initialOptions);
  const latestLayout = useRef(initialLayout);
  const dropped = useRef(0);
  const pingCounter = useRef(0);
  const errorsRef = useRef<string[]>([]);
  const quality = useMemo(() => evaluateAnnotationLayout(view.layout), [view.layout]);

  useEffect(() => {
    const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const onMessage = (event: MessageEvent<Reply>) => {
      if (event.origin && event.origin !== window.location.origin) return;
      const message = event.data;
      if (message.kind === 'ready') { setWorkerReady(true); setStatus('Worker is ready'); return; }
      if (message.id !== latestRequest.current || active.current?.id !== message.id) {
        dropped.current += 1;
        setDiscarded(dropped.current);
        return;
      }
      if (message.kind === 'error') {
        errorsRef.current = [...errorsRef.current, message.error];
        setErrors(errorsRef.current);
        setPending(false);
        setStatus(`Worker error: ${message.error}`);
        active.current = null;
        return;
      }
      const current = active.current;
      const { layout, reused } = shareUnchanged(latestLayout.current, message.layout);
      latestLayout.current = layout;
      committed.current = current.options;
      active.current = null;
      setPending(false);
      setView((previous) => ({
        options: current.options, layout, action: current.action,
        reused, commits: previous.commits + 1, resolverMs: message.resolverMs
      }));
      setStatus(`${current.action} completed in the Worker`);
    };
    const onError = (event: ErrorEvent) => {
      errorsRef.current = [...errorsRef.current, event.message];
      setErrors(errorsRef.current);
      setStatus('The Worker encountered an error');
      setPending(false);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    return () => {
      latestRequest.current += 1;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function request(action: string, options: LayoutOptions, delayMs = 220) {
    if (!workerRef.current || !workerReady) return;
    const id = ++latestRequest.current;
    active.current = { id, action, options };
    setPending(true);
    setStatus(`${action} queued in the Worker`);
    workerRef.current.postMessage({ id, options, delayMs } satisfies Request);
  }

  function moveFinalAnchor() {
    const next = structuredClone(committed.current);
    const last = next.annotations.at(-1)!;
    if (last.anchor.type !== 'point') return;
    last.anchor.point.x += last.anchor.point.x > 1060 ? -35 : 35;
    last.note.title = `Signal ${count} — moved`;
    request('Moved final anchor', next);
  }

  function moveObstacle() {
    const next = structuredClone(committed.current);
    const old = next.obstacles?.[1] ?? obstacles[1]!;
    next.obstacles = [...(next.obstacles ?? obstacles)];
    next.obstacles[1] = { ...old, x: old.x === 480 ? 550 : 480 };
    request('Moved a host obstacle', next);
  }

  function supersede() {
    const previous = structuredClone(committed.current);
    const newest = structuredClone(committed.current);
    newest.annotations.at(-1)!.note.title = 'Latest request wins';
    request('Slow obsolete request', previous, 510);
    request('Newer revision', newest, 0);
  }

  function delayed() {
    request('Cancellable slow revision', structuredClone(committed.current), 920);
  }

  function cancel() {
    if (!pending) return;
    latestRequest.current += 1;
    active.current = null;
    setPending(false);
    setStatus('Pending result ignored; committed annotations unchanged');
  }

  useEffect(() => {
    window.__annotationsExample = {
      name: 'react-worker',
      quality,
      qualitySummary: formatLayoutQualityReport(quality, { label: 'React Worker annotations' }),
      obstacles: view.options.obstacles,
      annotations: view.layout.annotations.map((item) => ({
        id: item.id, anchor: item.annotation.anchor, manual: item.annotation.placement?.manual,
        noteBox: item.noteBox
      }))
    };
    window.__annotationsWorkerDemo = {
      ready: workerReady, pending, commits: view.commits, discarded,
      pings, lastAction: view.action, errors,
      freshParity: () => JSON.stringify(resolveAnnotationLayout(committed.current)) === JSON.stringify(latestLayout.current)
    };
  }, [view, quality, workerReady, pending, discarded, pings, errors]);

  return (
    <main className="demo-shell">
      <header className="demo-heading">
        <div>
          <p className="eyebrow">Bronto Annotations / React + Web Worker</p>
          <h1>A busy layout. A responsive interface.</h1>
          <p className="intro">Resolve annotations off the main thread. Send a new revision, reject obsolete replies, or ignore a cancelled result while the UI stays interactive.</p>
        </div>
        <a className="source-link" href="https://github.com/Ponchia/bronto-annotations/tree/main/examples/react-worker">View example source ↗</a>
      </header>

      <section className="demo-card" aria-label="Off-main-thread annotation layout example">
        <div className="toolbar" role="group" aria-label="Worker layout actions">
          <button id="worker-move" type="button" onClick={moveFinalAnchor} disabled={!workerReady}>Move final anchor</button>
          <button id="worker-obstacle" type="button" onClick={moveObstacle} disabled={!workerReady}>Move host obstacle</button>
          <button id="worker-burst" type="button" onClick={supersede} disabled={!workerReady}>Supersede a request</button>
          <button id="worker-delay" type="button" onClick={delayed} disabled={!workerReady}>Start cancellable job</button>
          <button id="worker-cancel" type="button" onClick={cancel} disabled={!pending}>Ignore pending result</button>
          <button id="worker-ping" type="button" onClick={() => {
            pingCounter.current += 1;
            setPings(pingCounter.current);
          }}>Ping the UI</button>
        </div>
        <p id="worker-status" role="status" aria-live="polite" className="status">{status}</p>
        <p className="scroll-hint">Swipe sideways to explore the annotated surface <span aria-hidden="true">↔</span></p>
        <div className="stage-scroll" tabIndex={0} aria-label="Scrollable Worker-annotated diagram">
          <div className="workflow-stage">
            <svg className="workflow-base" role="img" aria-label="Two rows of source data connected through host-owned graph regions" viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
              <g aria-hidden="true">
                <path className="workflow-lane" d="M65 185H1065 M65 420H1065" />
                {(view.options.obstacles ?? []).map((box, i) => (
                  <g key={i}>
                    <rect className="workflow-node" x={box.x} y={box.y} width={box.width} height={box.height} rx="9" />
                    <text className="workflow-label" x={box.x + box.width / 2} y={box.y + box.height / 2 + 5} textAnchor="middle">{['Input', 'Transform', 'Output'][i]}</text>
                  </g>
                ))}
              </g>
            </svg>
            <AnnotationLayer
              annotations={view.options.annotations}
              bounds={bounds}
              obstacles={view.options.obstacles ?? []}
              noteSizes={noteSizes}
              resolvedLayout={view.layout}
              noteTabIndex={0}
              label="Worker-resolved annotation SVG layer"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
        <div className="metrics" aria-live="polite">
          <div className="metric"><span>Committed revision</span><strong id="worker-commits">{view.commits}</strong></div>
          <div className="metric"><span>Reused notes</span><strong id="worker-reused">{view.reused} / {view.layout.annotations.length}</strong></div>
          <div className="metric"><span>Worker solver time</span><strong>{view.resolverMs.toFixed(1)} ms</strong></div>
          <div className="metric"><span>Main-thread pings</span><strong id="worker-pings">{pings}</strong></div>
          <div className="metric"><span>Discarded old replies</span><strong id="worker-discarded">{discarded}</strong></div>
          <div className="metric"><span>Quality</span><strong>{quality.score} / 100</strong></div>
        </div>
      </section>
      <p className="footnote">The Worker is owned by this example, not the package. Results are accepted only for the current revision; ignoring a result does not interrupt its CPU work. Solver time excludes messaging, React rendering and browser paint.</p>
    </main>
  );
}

const root = document.querySelector('#root');
if (root) createRoot(root).render(<App />);
