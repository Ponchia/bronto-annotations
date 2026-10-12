import {
  resolveAnnotationLayout,
  renderAnnotationsSvg,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const annotations: Annotation[] = [{
  id: 'peak',
  anchor: { type: 'point', point: { x: 60, y: 120 } },
  note: { title: 'Peak response', body: 'An explanation attached to this point.' },
  placement: { side: 'right' }
}];

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 400, height: 240 },
  padding: 16
});

const container = document.createElement('div');
container.style.maxWidth = '640px';
container.style.fontFamily = 'system-ui, sans-serif';
container.style.aspectRatio = '400 / 240';
container.innerHTML = renderAnnotationsSvg(layout, {
  title: 'An annotated point',
  markerIdPrefix: 'first-annotation'
});
document.body.append(container);
