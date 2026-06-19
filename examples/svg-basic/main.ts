import {
  assertAnnotationLayoutQuality,
  badgeAnnotation,
  encircleCallout,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  subjectPath,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const bounds = { x: 0, y: 0, width: 760, height: 420 };
const obstacles = [
  { x: 376, y: 132, width: 132, height: 96 }
];
const annotations: Annotation[] = [
  {
    id: 'peak',
    anchor: { type: 'point', point: { x: 520, y: 92 } },
    note: {
      title: 'Peak response',
      body: 'The annotation engine places this note without owning the chart data.',
      line: true
    },
    style: {
      color: '#d12f6a',
      lineColor: '#d12f6a',
      noteBackground: '#fff7fb',
      subjectFill: 'rgba(209, 47, 106, 0.14)'
    },
    placement: { side: 'right' },
    motion: 'draw',
    priority: 2
  },
  {
    id: 'band',
    anchor: { type: 'point', point: { x: 289, y: 215 } },
    note: {
      title: 'Stable band',
      body: 'Structured subject geometry can mark a host-supplied region.',
      align: 'end',
      wrap: 28,
      line: { length: 120 }
    },
    placement: { side: 'left' },
    subject: {
      geometry: { type: 'band', x: 228, y: 172, width: 122, height: 86 },
      geometrySpace: 'absolute'
    },
    variant: 'band'
  },
  badgeAnnotation({
    id: 'release-marker',
    point: { x: 660, y: 84 },
    note: {
      title: '1',
      ariaLabel: 'First release marker'
    },
    tone: 'info',
    motion: 'pulse'
  }),
  encircleCallout({
    id: 'outlier-cluster',
    points: [
      { x: 590, y: 260 },
      { x: 620, y: 278 },
      { x: 602, y: 300 }
    ],
    pointRadius: 5,
    padding: 10,
    note: {
      title: 'Outlier cluster',
      body: 'The subject is computed from host-supplied points.',
      wrap: 28,
      line: true
    },
    placement: { side: 'left' },
    tone: 'success'
  })
];

const encircleSubject = annotations.find((annotation) => annotation.id === 'outlier-cluster')?.subject?.geometry;

const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  obstacles
});
const quality = evaluateAnnotationLayout(layout);
assertAnnotationLayoutQuality(quality, { label: 'SVG basic annotations' });

const chart = document.querySelector<HTMLDivElement>('#chart');

if (chart) {
  chart.innerHTML = `
    <svg class="base-chart" viewBox="0 0 ${bounds.width} ${bounds.height}" role="img" aria-label="Simple trend chart">
      <rect class="base-chart__plot" x="64" y="48" width="620" height="292" rx="6" />
      <path class="base-chart__grid" d="M64 122H684 M64 196H684 M64 270H684" />
      <path class="base-chart__line" d="M88 288 C 180 226, 196 232, 282 205 S 438 134, 520 92 S 620 132, 660 84" />
      <circle class="base-chart__point" cx="520" cy="92" r="6" />
      <circle class="base-chart__point" cx="590" cy="260" r="5" />
      <circle class="base-chart__point" cx="620" cy="278" r="5" />
      <circle class="base-chart__point" cx="602" cy="300" r="5" />
      <rect class="base-chart__band" x="228" y="172" width="122" height="86" rx="6" />
    </svg>
    ${renderAnnotationsSvg(layout, { title: 'SVG basic annotations', noteTabIndex: 0 })}
  `;

  Object.assign(window, {
    __annotationsExample: {
      name: 'svg-basic',
      quality,
      qualitySummary: formatLayoutQualityReport(quality, { label: 'SVG basic annotations' }),
      obstacles: layout.obstacles,
      encircleSubjectPath: encircleSubject ? subjectPath(encircleSubject) : ''
    }
  });
}
