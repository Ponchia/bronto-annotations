import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import './styles.css';

const bounds = { x: 0, y: 0, width: 860, height: 360 };
const obstacles = [
  { x: 42, y: 88, width: 238, height: 150 },
  { x: 323, y: 118, width: 224, height: 120 },
  { x: 590, y: 118, width: 224, height: 120 }
];
const annotations: Annotation[] = [
  {
    id: 'throughput',
    anchor: { type: 'box', box: { x: 42, y: 88, width: 238, height: 150 } },
    note: {
      title: 'Primary signal',
      body: 'The CSS bridge styles the package classes without making the core depend on a design system.'
    },
    placement: { side: 'bottom', align: 'start' },
    priority: 2
  },
  {
    id: 'coverage',
    anchor: { type: 'box', box: { x: 590, y: 118, width: 224, height: 120 } },
    note: {
      title: 'Follow-up area',
      body: 'Report authors can annotate existing cards, diagrams, screenshots, or SVG marks.'
    },
    placement: { side: 'top' }
  }
];

const layer = document.querySelector<HTMLDivElement>('#annotations');

if (layer) {
  const layout = resolveAnnotationLayout({
    annotations,
    bounds,
    obstacles,
    noteSizes: {
      throughput: { width: 238, height: 92 },
      coverage: { width: 220, height: 92 }
    }
  });
  const quality = evaluateAnnotationLayout(layout);
  assertAnnotationLayoutQuality(quality, { label: 'Bronto report annotations' });

  layer.innerHTML = renderAnnotationsSvg(layout, {
    noteTabIndex: 0,
    title: 'Bronto report annotations',
    preserveAspectRatio: 'none'
  });

  Object.assign(window, {
    __annotationsExample: {
      name: 'bronto-report',
      quality,
      qualitySummary: formatLayoutQualityReport(quality, { label: 'Bronto report annotations' }),
      obstacles: layout.obstacles
    }
  });
}
