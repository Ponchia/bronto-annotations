import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnnotationLayer } from '@ponchia/annotations/react';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '@ponchia/annotations';
import type { Annotation, Box, LayoutOptions, ResolvedLayout } from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const total = Number(new URLSearchParams(location.search).get('count')) || 40;
const bounds: Box = { x: 0, y: 0, width: 1750, height: 1450 };
const farObstacle: Box = { x: 1550, y: 1100, width: 70, height: 60 };
let serial = 0;

function note(i: number, routing: 'none' | 'orthogonal' = 'none'): Annotation {
  return {
    id: `annotation-${String(i).padStart(3, '0')}`,
    priority: 10000 - i,
    anchor: { type: 'point', point: { x: 60 + i % 11 * 110, y: 60 + Math.floor(i / 11) * 65 } },
    note: { title: `Note ${i}` },
    connector: { type: 'straight', routing },
    placement: {
      side: 'right', allowedSides: ['right'],
      align: 'center', allowedAligns: ['center'],
      offset: 12, crossOffset: 0, maxCandidates: 2
    }
  };
}
const initialNotes: Annotation[] = Array.from({ length: total }, (_, index) => note(index));
const baseOptions: Omit<LayoutOptions, 'annotations' | 'obstacles'> = {
  bounds, defaultNoteSize: { width: 92, height: 32 }, refinement: false
};
const freshSession = createIncrementalAnnotationLayoutSession({
  ...baseOptions, annotations: initialNotes, obstacles: [farObstacle]
});

type Result = {
  seq: number;
  action: string;
  annotations: number;
  reused: number;
  resolverMs: number;
  paintMs?: number;
  qualityScore?: number;
  noteCount?: number;
  exactParity?: boolean;
  identityPreserved?: boolean;
};

declare global {
  interface Window {
    __incrementalBrowser?: { events: Result[]; ready: boolean; lastLayout: ResolvedLayout };
    __stableFirstNote?: Element | null;
  }
}

window.__incrementalBrowser = { events: [], ready: false, lastLayout: freshSession.layout };

function App() {
  const session = useRef(freshSession);
  const [annotations, setAnnotations] = useState(initialNotes);
  const [obstacles, setObstacles] = useState<Box[]>([farObstacle]);
  const [layout, setLayout] = useState(freshSession.layout);
  const [actionLabel, setActionLabel] = useState('Ready');

  const update = useCallback((action: string, next: Annotation[], boxes: Box[]) => {
    const start = performance.now();
    const previous = session.current.layout;
    const updated = session.current.update({ ...baseOptions, annotations: next, obstacles: boxes });
    const resolverMs = performance.now() - start;
    const reused = updated.annotations.filter((item) => previous.annotations.includes(item)).length;
    const event: Result = {
      seq: ++serial,
      action,
      annotations: next.length,
      reused,
      resolverMs: Math.round(resolverMs * 1000) / 1000
    };
    window.__incrementalBrowser!.events.push(event);
    window.__incrementalBrowser!.lastLayout = updated;
    setAnnotations(next);
    setObstacles(boxes);
    setLayout(updated);
    setActionLabel(`${action}: ${reused}/${next.length} retained`);
    requestAnimationFrame(() => {
      event.paintMs = Math.round((performance.now() - start) * 1000) / 1000;
      event.noteCount = document.querySelectorAll('g.pa-annotation').length;
      event.identityPreserved = window.__stableFirstNote === document.querySelector('g.pa-annotation[data-annotation-id="annotation-000"]');
      event.qualityScore = evaluateAnnotationLayout(updated).score;
    });
  }, []);

  useLayoutEffect(() => {
    if (!window.__incrementalBrowser!.ready) {
      window.__stableFirstNote = document.querySelector('g.pa-annotation[data-annotation-id="annotation-000"]');
      window.__incrementalBrowser!.ready = true;
    }
  }, []);

  function append() {
    update('append', [...annotations, note(annotations.length)], obstacles);
  }
  function remove() {
    update('remove', annotations.slice(0, -1), obstacles);
  }
  function far() {
    const old = obstacles[0]!;
    update('move-far-obstacle', annotations, [{ ...old, x: 1500 + (old.x === 1500 ? 10 : 0) }]);
  }
  function near() {
    const last = layout.annotations.at(-1)!.noteBox;
    update('move-near-obstacle', annotations, [{ x: last.x + 2, y: last.y + 2, width: 35, height: 25 }]);
  }
  function late() {
    const changed = structuredClone(annotations);
    const last = changed.at(-1)!;
    if (last.anchor.type !== 'point') throw new Error('Expected point anchor');
    last.anchor.point.x += 18;
    update('move-late-anchor', changed, obstacles);
  }
  function noop() {
    update('no-op', structuredClone(annotations), structuredClone(obstacles));
  }
  function routing() {
    const changed = structuredClone(annotations);
    changed[0]!.connector = { type: 'straight', routing: 'orthogonal' };
    update('enable-route', changed, obstacles);
  }
  function validate() {
    const actual = resolveAnnotationLayout({ ...baseOptions, annotations, obstacles });
    const event = window.__incrementalBrowser!.events.at(-1);
    const exactParity = JSON.stringify(actual) === JSON.stringify(layout);
    if (event) event.exactParity = exactParity;
    if (!exactParity) throw new Error('Incremental browser fixture diverges from fresh layout');
  }

  return (
    <main style={{fontFamily:'system-ui',padding:12}}>
      <h1 style={{fontSize:20}}>Incremental layout browser proof</h1>
      <p aria-live="polite" id="status">{actionLabel}</p>
      <nav aria-label="Annotation geometry changes" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        <button id="append" onClick={append}>Append a node</button>
        <button id="remove" onClick={remove}>Remove a node</button>
        <button id="far" onClick={far}>Move far obstacle</button>
        <button id="near" onClick={near}>Move near obstacle</button>
        <button id="late" onClick={late}>Move last anchor</button>
        <button id="routing" onClick={routing}>Enable routed connector</button>
        <button id="noop" onClick={noop}>No-op update</button>
        <button id="validate" onClick={validate}>Compare full solver</button>
      </nav>
      <section aria-label="Graph annotated with host-controlled geometry" style={{position:'relative',width:bounds.width,height:bounds.height,overflow:'hidden'}}>
        <svg role="img" aria-label="Example graph nodes" viewBox={`0 0 ${bounds.width} ${bounds.height}`} width={bounds.width} height={bounds.height} style={{position:'absolute',inset:0}}>
          {annotations.map((item) => {
            const pt = item.anchor.type === 'point' ? item.anchor.point : {x:0,y:0};
            return <rect key={item.id} x={pt.x - 12} y={pt.y - 12} width={24} height={24} rx={4} fill="#64748b" />;
          })}
        </svg>
        <AnnotationLayer
          annotations={annotations}
          bounds={bounds}
          defaultNoteSize={{ width: 92, height: 32 }}
          obstacles={obstacles}
          resolvedLayout={layout}
          label="Incremental performance annotation layer"
          previewEdits
          editable={{ includeAnchor:true }}
          style={{position:'absolute',inset:0,pointerEvents:'none'}}
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
