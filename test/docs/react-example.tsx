import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';

export function AnnotatedPoint() {
  return (
    <AnnotationLayer
      annotations={[{
        id: 'peak',
        anchor: { type: 'point', point: { x: 180, y: 120 } },
        note: { title: 'Peak response' },
        placement: { side: 'right' }
      }]}
      bounds={{ x: 0, y: 0, width: 640, height: 360 }}
      label="An annotated point"
      markerIdPrefix="react-first-annotation"
    />
  );
}
