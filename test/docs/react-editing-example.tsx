import { useMemo, useState } from 'react';
import {
  applyAnnotationEdits,
  evaluateAnnotationLayout,
  resolveAnnotationLayout,
  type Annotation
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';

const bounds = { x: 0, y: 0, width: 560, height: 320 };
const protectedContent = { x: 120, y: 60, width: 125, height: 98 };
const initialAnnotations: Annotation[] = [{
  id: 'peak',
  anchor: { type: 'point', point: { x: 90, y: 135 } },
  note: { title: 'Peak response', body: 'Drag the handle.' },
  placement: { manual: { x: 40, y: 200 } }
}];
function resolve(annotations: Annotation[]) {
  return resolveAnnotationLayout({
    annotations, bounds, padding: 12,
    obstacles: [protectedContent],
    noteSizes: { peak: { width: 150, height: 60 } }
  });
}

export function FigureAnnotations() {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [previous, setPrevious] = useState<Annotation[] | null>(null);
  const [notice, setNotice] = useState('Drag the note handle or use its arrow keys.');
  const layout = useMemo(() => resolve(annotations), [annotations]);

  return (
    <section aria-label="Editable figure" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div role="region" aria-label="Figure surface" tabIndex={0} style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: 560, height: 320 }}>
          <svg viewBox="0 0 560 320" role="img" aria-label="Chart with protected content">
            <rect {...protectedContent} fill="#e7edeb" />
            <text x="132" y="88" fontSize="16">Chart data</text>
            <circle cx="90" cy="135" r="4" fill="#287c71" />
          </svg>
          <AnnotationLayer
            layout={layout}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            label="Figure callouts"
            markerIdPrefix="editable-figure"
            editable={{ keyboardStep: 10, keyboardLargeStep: 130 }}
            editHandleTabIndex={0}
            previewEdits
            onEditEnd={(event) => {
              const proposed = applyAnnotationEdits(annotations, event, { missing: 'throw' });
              const candidate = resolve(proposed);
              if (!evaluateAnnotationLayout(candidate).ok) {
                setNotice('Move rejected: keep the note inside the figure and clear of chart content.');
                return;
              }
              setPrevious(annotations);
              setAnnotations(proposed);
              setNotice('Move saved. Undo is available.');
            }}
          />
        </div>
      </div>
      <button type="button" style={{ minHeight: 44, padding: '8px 12px' }} disabled={!previous} onClick={() => {
        if (!previous) return;
        setAnnotations(previous);
        setPrevious(null);
        setNotice('Previous move restored.');
      }}>Undo last move</button>
      <p role="status">{notice}</p>
    </section>
  );
}
