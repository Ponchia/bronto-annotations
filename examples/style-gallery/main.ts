import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type AnnotationMotion,
  type AnnotationSubjectOptions,
  type AnnotationTone,
  type AnnotationVariant,
  type Box
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import './styles.css';

const variants: AnnotationVariant[] = [
  'label',
  'callout',
  'elbow',
  'curve',
  'circle',
  'rect',
  'threshold',
  'badge',
  'bracket',
  'band',
  'slope',
  'compare',
  'cluster',
  'axis',
  'timeline',
  'evidence'
];
const tones: AnnotationTone[] = ['accent', 'muted', 'success', 'warning', 'danger', 'info'];
const motions: AnnotationMotion[] = ['draw', 'reveal', 'pulse', 'focus'];
const bounds: Box = { x: 0, y: 0, width: 960, height: 560 };
const noteSizes = Object.fromEntries(variants.map((variant) => [variant, { width: 124, height: 46 }]));
const anchors = variants.map((variant, index) => {
  const column = index % 4;
  const row = Math.floor(index / 4);

  return {
    variant,
    x: 70 + column * 220,
    y: 74 + row * 122
  };
});
const annotations: Annotation[] = anchors.map(({ variant, x, y }, index) => {
  const tone = tones[index % tones.length]!;
  const motion = motions[index % motions.length]!;
  const style = index === 0
    ? {
      color: '#d12f6a',
      lineColor: '#d12f6a',
      noteBackground: '#fff7fb',
      subjectFill: 'rgba(209, 47, 106, 0.14)'
    }
    : undefined;

  return {
    id: variant,
    anchor: { type: 'point', point: { x, y } },
    note: {
      title: variant,
      body: tone
    },
    placement: {
      manual: { x: x + 58, y: y - 26, side: 'right' }
    },
    subject: subjectForVariant(variant, index),
    connector: {
      type: variant === 'curve' ? 'curve' : variant === 'elbow' ? 'elbow' : 'straight',
      end: variant === 'label' ? 'none' : 'arrow'
    },
    variant,
    tone,
    motion,
    ...(style ? { style } : {}),
    priority: variants.length - index
  };
});
const obstacles = anchors.map(({ x, y }) => ({ x: x - 18, y: y - 18, width: 36, height: 36 }));
const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  obstacles,
  padding: 24,
  noteSizes
});
const quality = evaluateAnnotationLayout(layout);
assertAnnotationLayoutQuality(quality, { label: 'Annotation style gallery' });
const stage = document.querySelector<HTMLElement>('#annotations');

if (stage) {
  const svg = renderAnnotationsSvg(layout, {
    title: 'Annotation style gallery',
    ariaLabel: 'All public annotation variants, tones, and motion classes rendered with package styling.',
    markerIdPrefix: 'style-gallery',
    noteTabIndex: 0,
    preserveAspectRatio: 'xMidYMin meet'
  });
  stage.innerHTML = svg.replace('class="pa-annotation-layer"', 'class="pa-annotation-layer style-gallery-svg"');
  const layer = stage.querySelector('.pa-annotation-layer');

  if (layer) {
    layer.insertAdjacentHTML('afterbegin', backgroundSvg());
  }
}

Object.assign(window, {
  __annotationsExample: {
    name: 'style-gallery',
    quality,
    qualitySummary: formatLayoutQualityReport(quality, { label: 'Annotation style gallery' }),
    variants,
    tones,
    motions,
    renderedVariants: variants.length,
    obstacles,
    classEvidence: variants.map((variant, index) => ({
      id: variant,
      variant,
      tone: tones[index % tones.length],
      motion: motions[index % motions.length]
    }))
  }
});

function subjectForVariant(variant: AnnotationVariant, index: number): AnnotationSubjectOptions {
  if (variant === 'badge') {
    return { badge: { label: 'B', x: 'right', y: 'top' } };
  }

  if (variant === 'rect') {
    return { shape: 'rect', padding: 9 };
  }

  if (variant === 'circle') {
    return { shape: 'circle', radius: 14 };
  }

  if (variant === 'threshold') {
    return {
      geometry: { type: 'threshold', x1: -26, y1: 0, x2: 26, y2: 0 },
      geometrySpace: 'anchor'
    };
  }

  if (variant === 'bracket') {
    return {
      geometry: { type: 'bracket', x1: -28, y1: 0, x2: 28, y2: 0, depth: 10 }
    };
  }

  if (variant === 'band') {
    return {
      geometry: { type: 'band', x: -24, y: -14, width: 48, height: 28 }
    };
  }

  if (variant === 'slope') {
    return {
      geometry: { type: 'slope', x1: -24, y1: 12, x2: 24, y2: -12 }
    };
  }

  if (variant === 'compare') {
    return {
      geometry: { type: 'compare', x1: -28, y1: -8, x2: 28, y2: -8, depth: 12 }
    };
  }

  if (variant === 'cluster') {
    return {
      geometry: {
        type: 'cluster',
        points: [{ x: -16, y: -8 }, { x: 12, y: -12 }, { x: 18, y: 14 }, { x: -10, y: 12 }],
        radius: 5
      }
    };
  }

  if (variant === 'axis') {
    return {
      geometry: { type: 'axis', orientation: 'horizontal', start: -30, end: 30 }
    };
  }

  if (variant === 'timeline') {
    return {
      geometry: { type: 'timeline', size: 18, direction: index % 2 === 0 ? 'up' : 'down' }
    };
  }

  if (variant === 'evidence') {
    return {
      geometry: { type: 'evidence', x: -20, y: -14, width: 40, height: 28, padding: 4 }
    };
  }

  return { shape: 'circle', radius: 9 };
}

function backgroundSvg(): string {
  const grid = anchors.map(({ variant, x, y }) => `
    <g aria-hidden="true">
      <circle class="style-gallery-anchor" cx="${x}" cy="${y}" r="18" />
      <text class="style-gallery-anchor-label" x="${x}" y="${y + 4}">${variant.slice(0, 3)}</text>
    </g>
  `).join('');

  return `
    <rect class="style-gallery-bg" x="0" y="0" width="${bounds.width}" height="${bounds.height}" />
    <path class="style-gallery-grid" d="${gridPath()}" />
    ${grid}
  `;
}

function gridPath(): string {
  const vertical = [0, 240, 480, 720, 960].map((x) => `M${x},0V560`).join('');
  const horizontal = [0, 140, 280, 420, 560].map((y) => `M0,${y}H960`).join('');

  return `${vertical}${horizontal}`;
}
