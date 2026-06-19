import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout,
  type AnchorAlignmentTarget
} from '@ponchia/annotations';
import {
  obstaclesFromD2Svg,
  prepareD2DiagramAnnotations
} from '@ponchia/annotations/d2';
import {
  annotationFrameFromSvg
} from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';
import { D2 } from '@terrastruct/d2';
import './styles.css';

const diagramHost = document.querySelector<HTMLElement>('#diagram');
const layer = document.querySelector<HTMLElement>('#annotations');

const source = `
input: Input
process: Process
output: Output
input -> process -> output
`;

async function render() {
  if (!diagramHost || !layer) {
    return;
  }

  const d2 = new D2();
  const result = await d2.compile(source, { layout: 'dagre' });
  diagramHost.innerHTML = await d2.render(result.diagram, {
    ...result.renderOptions,
    noXMLTag: true,
    pad: 0,
    scale: 1
  });

  const svg = diagramHost.querySelector<SVGSVGElement>('svg');

  if (!svg) {
    return;
  }

  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 24, right: 280, bottom: 24, left: 56 },
    preserveAspectRatio: svg.getAttribute('preserveAspectRatio') ?? 'xMinYMin meet'
  });
  const annotationSpecs = [
    {
      id: 'd2-process',
      shapeId: 'process',
      note: {
        title: 'Compiled D2 shape',
        body: 'The anchor uses D2 layout geometry from the compiled diagram.'
      },
      placement: { side: 'right' },
      priority: 2
    },
    {
      id: 'd2-route',
      connectionId: '(input -> process)[0]',
      note: {
        title: 'D2 edge route',
        body: 'Path anchors can follow a rendered diagram connection.'
      },
      placement: {
        side: 'right',
        allowedSides: ['right', 'left', 'bottom', 'top'],
        offset: [52, 64],
        crossOffset: [0, 72, -72]
      }
    }
  ];
  const prepared = prepareD2DiagramAnnotations(result.diagram, annotationSpecs, {
    obstacles: {
      includeConnections: true,
      padding: 4
    }
  });
  const processShape = result.diagram.shapes?.find((shape) => shape.id === 'process');
  const inputProcessConnection = result.diagram.connections?.find((connection) => connection.id === '(input -> process)[0]');
  const targetAlignmentTargets: AnchorAlignmentTarget[] = [
    {
      id: 'd2-process',
      expected: 'compiled D2 Process shape',
      ...(processShape ? {
        box: {
          x: processShape.pos.x,
          y: processShape.pos.y,
          width: processShape.width,
          height: processShape.height
        }
      } : {})
    },
    {
      id: 'd2-route',
      expected: 'compiled D2 input to process route',
      ...(inputProcessConnection?.route ? { points: inputProcessConnection.route } : {})
    }
  ];
  svg.setAttribute('viewBox', frame.viewBox);
  const renderedSvgObstacles = obstaclesFromD2Svg(svg, {
    coordinateSpace: svg,
    includeConnections: true,
    padding: 4
  });
  const layoutDefaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'D2 anchors',
    layoutLabel: 'D2 annotations'
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...layoutDefaults,
    bounds: frame.bounds,
    additionalObstacles: renderedSvgObstacles,
    padding: 8,
    noteSizes: {
      'd2-process': { width: 220, height: 90 },
      'd2-route': { width: 210, height: 86 }
    },
    targetAlignmentTargets,
    targetAlignmentOptions: {
      tolerance: 1,
      nearTolerance: 4,
      minOverlapRatio: 0.98
    },
    targetAlignmentFormat: {
      label: 'D2 target alignment',
      includeAligned: true
    },
    assertTargetAlignment: {
      label: 'D2 target alignment',
      failOnWarnings: true
    }
  });
  const layout = resolved.layout;
  const targetAlignment = resolved.targetAlignment;
  const targetAlignmentSummary = resolved.targetAlignmentSummary;

  layer.innerHTML = renderAnnotationsSvg(layout, {
    noteTabIndex: 0,
    title: 'D2 annotations',
    preserveAspectRatio: frame.preserveAspectRatio
  });

  Object.assign(window, {
    __annotationsExample: {
      name: 'd2-basic',
      quality: resolved.quality,
      validationSummary: resolved.validationSummary,
      qualitySummary: resolved.qualitySummary,
      targetAlignment,
      targetAlignmentSummary,
      anchorSource: 'd2-diagram',
      renderedShapes: result.diagram.shapes.length,
      renderedConnections: result.diagram.connections.length,
      renderedSvgObstacles: renderedSvgObstacles.length,
      validation: prepared.validation,
      anchorEvidence: prepared.annotations.map((annotation) => annotation.data),
      anchorIds: prepared.annotations.map((annotation) => annotation.id),
      obstacles: resolved.obstacles
    }
  });
}

void render();
