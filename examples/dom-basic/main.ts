import {
  assertAnchorValidationReport,
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation
} from '@ponchia/annotations';
import { extractedAnchorFromElement, validateDomAnchors } from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';
import './styles.css';

const surface = document.querySelector<HTMLElement>('.dom-surface');
const layer = document.querySelector<HTMLElement>('#annotations');

function render() {
  if (!surface || !layer) {
    return;
  }

  const primary = document.querySelector<HTMLElement>('#primary-region');
  const secondary = document.querySelector<HTMLElement>('#secondary-region');

  if (!primary || !secondary) {
    return;
  }

  assertAnchorValidationReport(validateDomAnchors(document, [
    {
      id: 'primary-region',
      selector: '#primary-region',
      coordinateSpace: surface,
      source: 'dom-rect'
    },
    {
      id: 'secondary-region',
      selector: '#secondary-region',
      coordinateSpace: surface,
      source: 'dom-rect'
    }
  ]), { label: 'DOM anchors' });

  const primaryAnchor = extractedAnchorFromElement(primary, {
    id: 'primary-region',
    coordinateSpace: surface,
    source: 'dom-rect'
  });
  const secondaryAnchor = extractedAnchorFromElement(secondary, {
    id: 'secondary-region',
    coordinateSpace: surface,
    source: 'dom-rect'
  });
  const bounds = {
    x: 0,
    y: 0,
    width: surface.clientWidth,
    height: surface.clientHeight
  };
  const compact = bounds.width < 520;
  const noteWidth = compact ? Math.max(168, Math.min(190, bounds.width - 36)) : 210;
  const obstacles = [primaryAnchor.anchor, secondaryAnchor.anchor]
    .flatMap((anchor) => anchor.type === 'box' ? [anchor.box] : []);
  const annotations: Annotation[] = [
    {
      id: 'primary-region',
      anchor: primaryAnchor.anchor,
      note: {
        title: 'Measured DOM box',
        body: 'This note is placed from getBoundingClientRect geometry.'
      },
      placement: compact
        ? {
          side: 'top',
          allowedSides: ['top', 'bottom', 'right', 'left'],
          offset: [12, 20],
          crossOffset: [0, 48, -48]
        }
        : { side: 'right' },
      data: { anchorSource: primaryAnchor.source },
      priority: 2
    },
    {
      id: 'secondary-region',
      anchor: secondaryAnchor.anchor,
      note: {
        title: 'Same coordinate space',
        body: 'The DOM adapter normalizes the region into layer coordinates.'
      },
      placement: compact
        ? {
          side: 'top',
          allowedSides: ['top', 'bottom', 'left', 'right'],
          offset: [12, 20],
          crossOffset: [48, 0, -48]
        }
        : { side: 'left' },
      data: { anchorSource: secondaryAnchor.source }
    }
  ];

  const layout = resolveAnnotationLayout({
    annotations,
    bounds,
    obstacles,
    padding: 18,
    noteSizes: {
      'primary-region': { width: noteWidth, height: compact ? 94 : 86 },
      'secondary-region': { width: noteWidth, height: compact ? 94 : 86 }
    }
  });
  const quality = evaluateAnnotationLayout(layout);
  assertAnnotationLayoutQuality(quality, { label: 'DOM basic annotations' });

  layer.innerHTML = renderAnnotationsSvg(layout, { title: 'DOM basic annotations', noteTabIndex: 0 });

  Object.assign(window, {
    __annotationsExample: {
      name: 'dom-basic',
      quality,
      qualitySummary: formatLayoutQualityReport(quality, { label: 'DOM basic annotations' }),
      anchorSource: 'dom-rect',
      anchorIds: annotations.map((annotation) => annotation.id),
      obstacles: layout.obstacles
    }
  });
}

render();

if (surface && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(render).observe(surface);
}
