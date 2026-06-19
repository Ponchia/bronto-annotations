import { AnnotationLayer } from '@ponchia/annotations/react';
import {
  generatedSurfaceLayoutDefaults,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './styles.css';

const bounds = { x: 0, y: 0, width: 760, height: 420 };
const layoutDefaults = generatedSurfaceLayoutDefaults({
  includeInfo: true,
  layoutLabel: 'React basic annotations'
});
const obstacles = [
  { x: 160, y: 142, width: 150, height: 70 },
  { x: 512, y: 142, width: 150, height: 70 },
  { x: 408, y: 168, width: 48, height: 40 }
];
const initialAnnotations: Annotation[] = [
  {
    id: 'queue',
    anchor: { type: 'box', box: { x: 160, y: 142, width: 150, height: 70 } },
    note: {
      title: 'Input queue',
      body: 'The host supplies geometry. The adapter only renders resolved layout.',
      line: true
    },
    placement: { side: 'top' }
  },
  {
    id: 'decision',
    anchor: { type: 'point', point: { x: 432, y: 188 } },
    note: {
      title: 'Decision point',
      body: 'React uses the same deterministic core as the SVG renderer.',
      align: 'center',
      wrap: 26,
      line: { length: 150 }
    },
    placement: { side: 'right' },
    priority: 2
  }
];

function App() {
  const [annotations, setAnnotations] = useState(initialAnnotations);

  return (
    <main className="example-shell">
      <section className="flow-surface" aria-label="React annotation example">
        <svg className="flow-surface__base" viewBox={`0 0 ${bounds.width} ${bounds.height}`} role="img">
          <rect className="flow-surface__node" x="160" y="142" width="150" height="70" rx="8" />
          <rect className="flow-surface__node" x="512" y="142" width="150" height="70" rx="8" />
          <path className="flow-surface__edge" d="M310 177H408 L432 188 L456 177H512" />
          <circle className="flow-surface__decision" cx="432" cy="188" r="10" />
          <text className="flow-surface__label" x="235" y="183" textAnchor="middle">Collect</text>
          <text className="flow-surface__label" x="587" y="183" textAnchor="middle">Publish</text>
        </svg>
        <AnnotationLayer
          annotations={annotations}
          bounds={bounds}
          editable={{ includeAnchor: true, noteHandlePosition: 'bottom-right' }}
          obstacles={obstacles}
          padding={18}
          measure="dom"
          noteTabIndex={0}
          onEdit={(event) => {
            Object.assign(window, {
              __annotationsLastEdit: {
                annotationId: event.annotationId,
                phase: event.phase,
                anchor: event.suggestedAnchor,
                manual: event.suggestedPlacement?.manual
              }
            });
          }}
          onEditEnd={(event) => {
            if (!event.suggestedAnnotation) {
              return;
            }

            setAnnotations((current) => current.map((annotation) => (
              annotation.id === event.annotationId ? event.suggestedAnnotation! : annotation
            )));
          }}
          assertQuality={layoutDefaults.assertQuality}
          qualityFormat={layoutDefaults.qualityFormat}
          onQuality={({ layout, quality, summary }) => {
            Object.assign(window, {
              __annotationsExample: {
                name: 'react-basic',
                quality,
                qualitySummary: summary,
                annotations: layout.annotations.map((item) => ({
                  id: item.id,
                  anchor: item.annotation.anchor,
                  manual: item.annotation.placement?.manual,
                  noteBox: item.noteBox
                })),
                obstacles: layout.obstacles
              }
            });
          }}
          style={{ width: '100%', height: '100%' }}
          renderNote={(item) => (
            <>
              {item.annotation.note.line ? (
                <span className="pa-annotation__note-line" aria-hidden="true" data-note-line="true" />
              ) : null}
              <strong className="pa-annotation__title">{item.annotation.note.title}</strong>
              <span className="pa-annotation__body pa-annotation__label">{item.annotation.note.body}</span>
            </>
          )}
        />
      </section>
    </main>
  );
}

const root = document.querySelector('#root');

if (root) {
  createRoot(root).render(<App />);
}
