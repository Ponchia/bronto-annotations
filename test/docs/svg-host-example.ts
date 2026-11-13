import { renderAnnotationsSvg, resolveAnnotationLayout } from '@ponchia/annotations';
import { annotationFrameFromSvg, boxFromSvgElement } from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';

export function annotateExistingSvg(svg: SVGSVGElement, overlay: HTMLElement) {
  const mark = svg.querySelector<SVGGraphicsElement>('#peak-mark');
  if (!mark) throw new Error('SVG target #peak-mark not found');

  const box = boxFromSvgElement(mark, svg);
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
    throw new Error('SVG target #peak-mark has no valid geometry');
  }

  const frame = annotationFrameFromSvg(svg);
  const layout = resolveAnnotationLayout({
    annotations: [{
      id: 'peak',
      anchor: { type: 'box', box },
      note: { title: 'Peak response' }
    }],
    bounds: frame.bounds,
    padding: 16
  });

  overlay.innerHTML = renderAnnotationsSvg(layout, {
    title: 'Chart annotations',
    preserveAspectRatio: frame.preserveAspectRatio,
    markerIdPrefix: 'existing-chart-notes'
  });
  return layout;
}
