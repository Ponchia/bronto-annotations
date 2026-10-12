import {
  resolveAnnotationLayout,
  renderAnnotationsSvg,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const annotations: Annotation[] = [{
  id: 'peak',
  anchor: { type: 'point', point: { x: 180, y: 120 } },
  note: { title: 'Peak response', body: 'An explanation attached to this point.' },
  placement: { side: 'right' }
}];

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 640, height: 360 },
  padding: 16
});

const container = document.createElement('div');
container.innerHTML = renderAnnotationsSvg(layout, {
  title: 'An annotated point',
  markerIdPrefix: 'first-annotation'
});
document.body.append(container);
