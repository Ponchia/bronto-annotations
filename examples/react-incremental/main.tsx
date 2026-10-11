import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  type Annotation,
  type Box,
  type ResolvedAnnotation
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Everything here belongs to the host. The annotation library owns the
// placement engine and SVG layer; it does not own graph state or persistence.
const bounds: Box = { x: 0, y: 0, width: 860, height: 500 };
const obstacles: Box[] = [
  { x: 102, y: 210, width: 170, height: 80 },
  { x: 350, y: 210, width: 170, height: 80 },
  { x: 598, y: 210, width: 170, height: 80 }
];
const noteSizes: Record<string, { width: number; height: number }> = {
  intake: { width: 144, height: 72 },
  triage: { width: 165, height: 74 },
  delivery: { width: 174, height: 74 },
  signal: { width: 164, height: 74 },
  added: { width: 150, height: 70 }
};
const initialAnnotations: Annotation[] = [
  {
    id: 'intake', priority: 4,
    anchor: { type: 'box', box: obstacles[0]! },
    note: { title: 'Intake', body: 'Source geometry stays fixed.' },
    placement: { manual: { x: 70, y: 92, side: 'top' } }
  },
  {
    id: 'triage', priority: 3,
    anchor: { type: 'box', box: obstacles[1]! },
    note: { title: 'Triage', body: 'Previous placements can be reused.' },
    placement: { manual: { x: 354, y: 354, side: 'bottom' } }
  },
  {
    id: 'delivery', priority: 2,
    anchor: { type: 'box', box: obstacles[2]! },
    note: { title: 'Delivery', body: 'One authoritative resolved layout.' },
    placement: { manual: { x: 620, y: 92, side: 'top' } }
  },
  {
    id: 'signal', priority: 1,
    anchor: { type: 'point', point: { x: 435, y: 248 } },
    note: { title: 'Live marker', body: 'Move this anchor or drag the note.' },
    placement: { manual: { x: 307, y: 83, side: 'top' } }
  }
];

function optionsFor(annotations: Annotation[]) {
  return { annotations, bounds, obstacles, padding: 16, noteSizes, refinement: false as const };
}

type DemoView = {
  annotations: Annotation[];
  layout: ReturnType<typeof createIncrementalAnnotationLayoutSession>['layout'];
  reused: number;
  action: string;
  changes: number;
};

function noteContent(item: ResolvedAnnotation) {
  return (
    <>
      <strong className="pa-annotation__title">{item.annotation.note.title}</strong>
      <span className="pa-annotation__body pa-annotation__label">{item.annotation.note.body}</span>
    </>
  );
}

function App() {
  const session = useRef<ReturnType<typeof createIncrementalAnnotationLayoutSession> | null>(null);
  if (!session.current) session.current = createIncrementalAnnotationLayoutSession(optionsFor(initialAnnotations));
  const [view, setView] = useState<DemoView>(() => ({
    annotations: initialAnnotations,
    layout: session.current!.layout,
    reused: 0,
    action: 'Initial layout',
    changes: 0
  }));
  const quality = useMemo(() => evaluateAnnotationLayout(view.layout), [view.layout]);
  const hasAddedNote = view.annotations.some((annotation) => annotation.id === 'added');

  // Commit once. Pointer-move previews do not touch host state or rerun the
  // solver. The host owns when to update and what state to persist.
  function commit(nextAnnotations: Annotation[], action: string) {
    const previous = session.current!.layout;
    const next = session.current!.update(optionsFor(nextAnnotations));
    const oldById = new Map(previous.annotations.map((item) => [item.id, item]));
    const reused = next.annotations.filter((item) => oldById.get(item.id) === item).length;
    setView((last) => ({
      annotations: nextAnnotations,
      layout: next,
      reused,
      action,
      changes: last.changes + 1
    }));
  }

  function moveLastAnchor() {
    const next = view.annotations.map((item) => item.id === 'signal'
      ? {
          ...item,
          anchor: {
            type: 'point' as const,
            point: { x: item.anchor.type === 'point' && item.anchor.point.x === 435 ? 490 : 435,
              y: item.anchor.type === 'point' && item.anchor.point.y === 248 ? 300 : 248 }
          }
        }
      : item);
    commit(next, 'Moved the final anchor');
  }

  function addAnnotation() {
    if (hasAddedNote) return;
    commit([...view.annotations, {
      id: 'added', priority: 0,
      anchor: { type: 'point', point: { x: 689, y: 250 } },
      note: { title: 'New annotation', body: 'Earlier placements are unchanged.' },
      placement: { manual: { x: 637, y: 354, side: 'bottom' } }
    }], 'Appended a lower-priority note');
  }

  function removeAnnotation() {
    if (!hasAddedNote) return;
    commit(view.annotations.filter((item) => item.id !== 'added'), 'Removed the final note');
  }

  useEffect(() => {
    Object.assign(window, {
      __annotationsExample: {
        name: 'react-incremental',
        quality,
        qualitySummary: formatLayoutQualityReport(quality, { label: 'React incremental annotations' }),
        obstacles,
        action: view.action,
        reused: view.reused,
        changes: view.changes,
        annotations: view.layout.annotations.map((item) => ({
          id: item.id,
          anchor: item.annotation.anchor,
          manual: item.annotation.placement?.manual,
          noteBox: item.noteBox
        }))
      }
    });
  }, [quality, view]);

  return (
    <main className="demo-shell">
      <header className="demo-heading">
        <div>
          <p className="eyebrow">Bronto Annotations / React</p>
          <h1>Change one note. Keep the rest.</h1>
          <p className="intro">A host-controlled layout in practice. Drag the handles or change the graph; earlier placements stay put when they can.</p>
        </div>
        <a className="source-link" href="https://github.com/Ponchia/bronto-annotations/tree/main/examples/react-incremental">View example source <span aria-hidden="true">↗</span></a>
      </header>

      <section className="demo-card" aria-label="Live incremental annotation editor">
        <div className="toolbar" role="group" aria-label="Annotation editing actions">
          <button id="move-note" type="button" onClick={moveLastAnchor}>Move final anchor</button>
          <button id="append-note" type="button" onClick={addAnnotation} disabled={hasAddedNote}>Add annotation</button>
          <button id="remove-note" type="button" onClick={removeAnnotation} disabled={!hasAddedNote}>Remove added note</button>
          <button id="reset-note" type="button" onClick={() => commit(structuredClone(initialAnnotations), 'Reset to initial diagram')}>Reset</button>
        </div>
        <p className="scroll-hint">Swipe sideways to follow the diagram <span aria-hidden="true">↔</span></p>

        <div className="stage-scroll" tabIndex={0} aria-label="Scrollable diagram with editable annotations">
          <div className="workflow-stage">
            <svg className="workflow-base" role="img" aria-label="Intake flows through Triage to Delivery" viewBox="0 0 860 500">
              <defs>
                <marker id="workflow-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0 0L6 3L0 6Z" fill="#83919e" />
                </marker>
              </defs>
              <path className="workflow-lane" d="M272 250H350 M520 250H598" markerEnd="url(#workflow-arrow)" />
              {obstacles.map((box, i) => (
                <g key={i} aria-hidden="true">
                  <rect className="workflow-node" x={box.x} y={box.y} width={box.width} height={box.height} rx="13" />
                  <text className="workflow-label" x={box.x + box.width / 2} y={box.y + box.height / 2 + 5} textAnchor="middle">
                    {['Intake', 'Triage', 'Delivery'][i]}
                  </text>
                </g>
              ))}
            </svg>
            <AnnotationLayer
              annotations={view.annotations}
              bounds={bounds}
              obstacles={obstacles}
              noteSizes={noteSizes}
              padding={16}
              refinement={false}
              resolvedLayout={view.layout}
              editable={{ includeAnchor: true, noteHandlePosition: 'bottom-right' }}
              previewEdits
              noteTabIndex={0}
              renderNote={noteContent}
              onEditEnd={(event) => {
                if (!event.suggestedAnnotation) return;
                commit(view.annotations.map((item) => item.id === event.annotationId
                  ? event.suggestedAnnotation! : item), `Edited ${event.annotationId} by dragging`);
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div className="metrics" aria-live="polite" aria-atomic="true">
          <div className="metric"><span>Current action</span><strong id="current-action">{view.action}</strong></div>
          <div className="metric"><span>Reused placements</span><strong id="reused-placements">{view.reused} / {view.layout.annotations.length}</strong></div>
          <div className="metric"><span>Visible annotations</span><strong id="annotation-count">{view.layout.annotations.length}</strong></div>
          <div className="metric"><span>Layout quality</span><strong id="quality-score">{quality.score} / 100</strong></div>
        </div>
      </section>
      <p className="footnote">The host commits an edit once, then passes its resolved layout back to React. Drag feedback is visual-only until release. Global geometry changes may still require a full resolution.</p>
    </main>
  );
}

const root = document.querySelector('#root');
if (root) createRoot(root).render(<App />);
