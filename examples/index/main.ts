import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type Box
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import './styles.css';

const bounds: Box = { x: 0, y: 0, width: 760, height: 420 };
const obstacles: Box[] = [
  { x: 90, y: 74, width: 72, height: 52 },
  { x: 90, y: 218, width: 72, height: 52 },
  { x: 548, y: 158, width: 72, height: 52 }
];
const annotations: Annotation[] = [
  {
    id: 'start',
    anchor: { type: 'box', box: obstacles[0]! },
    note: {
      title: 'Examples index',
      body: 'Pick the host context first, then use the matching adapter.'
    },
    placement: { manual: { x: 196, y: 54, side: 'right' } },
    variant: 'callout',
    tone: 'accent',
    motion: 'draw',
    priority: 3
  },
  {
    id: 'generated',
    anchor: { type: 'box', box: obstacles[1]! },
    note: {
      title: 'Generated surfaces',
      body: 'Vega, Mermaid, D2, and React Flow examples use rendered host geometry.'
    },
    placement: { manual: { x: 196, y: 214, side: 'right' } },
    variant: 'elbow',
    tone: 'info',
    priority: 2
  },
  {
    id: 'styles',
    anchor: { type: 'box', box: obstacles[2]! },
    note: {
      title: 'Styling gallery',
      body: 'The style gallery covers every variant, tone, and motion hint.'
    },
    placement: { manual: { x: 340, y: 122, side: 'left' } },
    variant: 'badge',
    tone: 'warning',
    motion: 'pulse',
    subject: { badge: { label: 'CSS', x: 'right', y: 'top' } }
  }
];
const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  obstacles,
  padding: 20,
  noteSizes: {
    start: { width: 184, height: 68 },
    generated: { width: 190, height: 76 },
    styles: { width: 178, height: 76 }
  }
});
const quality = evaluateAnnotationLayout(layout);
assertAnnotationLayoutQuality(quality, { label: 'Examples index annotations' });
const overview = document.querySelector<HTMLElement>('#overview-chart');

if (overview) {
  const svg = renderAnnotationsSvg(layout, {
    title: 'Examples index annotations',
    markerIdPrefix: 'examples-index',
    noteTabIndex: 0,
    preserveAspectRatio: 'xMidYMin meet'
  });
  overview.innerHTML = svg.replace('class="pa-annotation-layer"', 'class="pa-annotation-layer overview-svg"');
  overview.querySelector('.pa-annotation-layer')?.insertAdjacentHTML('afterbegin', backgroundSvg());
}

Object.assign(window, {
  __annotationsExample: {
    name: 'examples-index',
    quality,
    qualitySummary: formatLayoutQualityReport(quality, { label: 'Examples index annotations' }),
    obstacles,
    links: [
      'svg-basic',
      'react-basic',
      'bronto-report',
      'dom-basic',
      'vega-basic',
      'mermaid-basic',
      'd2-basic',
      'react-flow-basic',
      'style-gallery'
    ]
  }
});

function backgroundSvg(): string {
  return `
    <rect class="overview-bg" x="0" y="0" width="${bounds.width}" height="${bounds.height}" />
    <path class="overview-lane" d="M126 126V218M162 244H548M548 184H348" fill="none" />
    <g aria-hidden="true">
      <rect class="overview-node overview-node--accent" x="90" y="74" width="72" height="52" rx="8" />
      <text class="overview-node-label" x="126" y="105">Start</text>
      <rect class="overview-node" x="90" y="218" width="72" height="52" rx="8" />
      <text class="overview-node-label" x="126" y="249">Adapters</text>
      <rect class="overview-node" x="548" y="158" width="72" height="52" rx="8" />
      <text class="overview-node-label" x="584" y="189">Styles</text>
    </g>
  `;
}
