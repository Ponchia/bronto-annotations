import {
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import { prepareDomAnnotations } from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';

export function annotateReport(surface: HTMLElement, overlay: HTMLElement) {
  const prepared = prepareDomAnnotations(surface, [{
    id: 'report-metric',
    selector: '#metric-card',
    coordinateSpace: surface,
    note: { title: 'Measured metric' }
  }], { assert: { label: 'Report targets' } });

  const resolved = resolvePreparedAnnotationLayout(prepared, {
    bounds: {
      x: 0, y: 0, width: surface.clientWidth, height: surface.clientHeight
    },
    padding: 16
  });
  overlay.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Report annotations',
    markerIdPrefix: 'report-notes'
  });
  return resolved;
}
