import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(new URL('..', import.meta.url).pathname);
const screenshotsDir = resolve(root, '.tmp/screenshots');
const viewports = [
  { name: 'desktop', width: 1200, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];
const examples = [
  { name: 'index', text: 'Examples index', minObstacles: 3, verifyExamplesIndex: true },
  { name: 'svg-basic', text: 'Peak response', minObstacles: 1, hostLayerSelector: '.base-chart', verifyStyle: true, verifyMotionMedia: true, verifyForcedColors: true },
  { name: 'react-basic', text: 'Decision point', minObstacles: 3, minEditHandles: 4, verifyEditDrag: true, hostLayerSelector: '.flow-surface__base' },
  { name: 'bronto-report', text: 'Primary signal', minObstacles: 3, verifyLegacyBrontoCss: true, verifyBrontoPackageCss: true },
  { name: 'dom-basic', text: 'Measured DOM box', source: 'dom-rect', minObstacles: 2 },
  {
    name: 'style-gallery',
    text: 'Annotation style gallery',
    minObstacles: 16,
    verifyStyleGallery: true
  },
  {
    name: 'vega-basic',
    text: 'Generated Vega mark',
    source: 'vega-scenegraph',
    minRendered: 'renderedMarks',
    minObstacles: 1,
    minCandidates: 10,
    validateAnchors: true,
    validateTargetAlignment: true,
    hostLayerSelector: '#chart > svg',
    requiredEvidence: [
      { vegaMarkName: 'points', vegaMarkType: 'symbol' }
    ],
    anchorTargetChecks: [
      { annotationId: 'vega-peak', selector: '#chart svg path[aria-label="point-peak"]', maxCenterDistance: 10 },
      { annotationId: 'vega-settled', selector: '#chart svg path[aria-label="point-settled"]', maxCenterDistance: 10 }
    ]
  },
  {
    name: 'mermaid-basic',
    text: 'Mermaid node',
    source: 'mermaid-svg',
    minRendered: 'renderedNodes',
    minObstacles: 3,
    validateAnchors: true,
    validateTargetAlignment: true,
    hostLayerSelector: '#diagram > svg',
    requiredEvidence: [
      { mermaidKind: 'label', mermaidLabel: 'API' },
      { mermaidKind: 'label', mermaidLabel: 'Report' },
      { mermaidKind: 'edge', mermaidId: 'api-report' }
    ],
    anchorTargetChecks: [
      { annotationId: 'mermaid-api', selector: '#diagram svg g.node', text: 'API', maxCenterDistance: 10 },
      { annotationId: 'mermaid-report', selector: '#diagram svg g.node', text: 'Report', maxCenterDistance: 10 },
      { annotationId: 'mermaid-edge', selector: '#diagram svg path[data-edge-id="api-report"]', maxCenterDistance: 14 }
    ]
  },
  {
    name: 'd2-basic',
    text: 'Compiled D2 shape',
    source: 'd2-diagram',
    minRendered: 'renderedShapes',
    minRenderedSvgObstacles: 1,
    minObstacles: 3,
    validateAnchors: true,
    validateTargetAlignment: true,
    hostLayerSelector: '#diagram > svg',
    requiredEvidence: [
      { d2Kind: 'shape', d2ShapeId: 'process' },
      { d2Kind: 'connection', d2ConnectionId: '(input -> process)[0]' }
    ],
    anchorTargetChecks: [
      { annotationId: 'd2-process', selector: '#diagram svg g', text: 'Process', maxCenterDistance: 10 },
      { annotationId: 'd2-route', selector: '#diagram svg path.connection', index: 0, maxCenterDistance: 10 }
    ]
  },
  {
    name: 'react-flow-basic',
    text: 'React Flow node',
    source: 'react-flow-state',
    minRendered: 'renderedNodes',
    minGeneratedObstacles: 5,
    minObstacles: 5,
    minEditHandles: 3,
    validateAnchors: true,
    validateTargetAlignment: true,
    verifyViewportTransform: true,
    verifyReactFlowEditDrag: true,
    requiredEvidence: [
      { reactFlowKind: 'node', reactFlowNodeId: 'review' },
      { reactFlowKind: 'edge', reactFlowEdgeId: 'review-publish' },
      { reactFlowKind: 'handle', reactFlowNodeId: 'review', reactFlowHandleType: 'source', reactFlowHandleSide: 'right' }
    ],
    requiredSelectors: [
      '.react-flow__node[data-id="review"]',
      '.react-flow__edge[data-id="review-publish"]',
      '.react-flow__node[data-id="review"] .react-flow__handle-right'
    ],
    anchorTargetChecks: [
      { annotationId: 'flow-review', selector: '.react-flow__node[data-id="review"]', maxCenterDistance: 10 },
      { annotationId: 'flow-edge', selector: '.react-flow__edge[data-id="review-publish"]', maxCenterDistance: 14 },
      { annotationId: 'flow-handle', selector: '.react-flow__node[data-id="review"] .react-flow__handle-right', maxCenterDistance: 10 }
    ]
  }
];

await mkdir(screenshotsDir, { recursive: true });

const server = await createServer({
  root,
  logLevel: 'error',
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: false
  }
});

await server.listen();

const address = server.httpServer?.address();
if (!address || typeof address === 'string') {
  throw new Error('Could not determine Vite server port.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();

try {
  for (const viewport of viewports) {
    for (const example of examples) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const consoleErrors = [];
      const pageErrors = [];
      const label = `${example.name} (${viewport.name})`;

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await page.goto(`${baseUrl}/examples/${example.name}/`, { waitUntil: 'networkidle' });

      try {
        await page.waitForFunction(() => document.querySelectorAll('.pa-annotation').length > 0, null, {
          timeout: 30000
        });
        await page.waitForFunction((text) => document.body.textContent?.includes(text), example.text, {
          timeout: 30000
        });
      } catch (error) {
        throw new Error(`${label} did not render the initial annotation layer: ${error instanceof Error ? error.message : String(error)}${formatBrowserErrors(consoleErrors, pageErrors)}`);
      }

      const evidence = await page.evaluate(() => {
        const connectors = Array.from(document.querySelectorAll('.pa-annotation__connector'));
        const notes = Array.from(document.querySelectorAll('.pa-annotation__note'));
        const noteBoxElements = Array.from(document.querySelectorAll('.pa-annotation-layer .pa-annotation__note-box'));
        const focusableNotes = Array.from(document.querySelectorAll('.pa-annotation__note[tabindex], .pa-annotation__note-box[tabindex]'))
          .filter((element) => element.getAttribute('tabindex') !== '-1');
        const layer = document.querySelector('.pa-annotation-layer');
        const exampleData = window.__annotationsExample;
        const noteBoxes = noteBoxElements.map((note) => {
          const rect = note.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          };
        });
        const layerRect = layer?.getBoundingClientRect();
        const connectorBoxes = connectors.map((connector) => {
          const rect = connector.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            d: connector.getAttribute('d') ?? ''
          };
        });
        const noteOverlapArea = noteBoxes.reduce((total, box, index) => {
          return total + noteBoxes.slice(index + 1).reduce((pairTotal, other) => {
            return pairTotal + overlapArea(box, other);
          }, 0);
        }, 0);
        const viewBox = layer instanceof SVGSVGElement ? layer.viewBox.baseVal : undefined;
        const obstacleBoxes = Array.isArray(exampleData?.obstacles)
          ? exampleData.obstacles.filter(isFiniteBox)
          : [];
        const obstacleClientBoxes = layerRect && viewBox && viewBox.width > 0 && viewBox.height > 0
          ? obstacleBoxes.map((box) => mapSvgBoxToClient(box, layer, layerRect, viewBox))
          : [];
        const noteObstacleOverlapArea = noteBoxes.reduce((total, note) => {
          return total + obstacleClientBoxes.reduce((obstacleTotal, obstacle) => {
            return obstacleTotal + overlapArea(note, obstacle);
          }, 0);
        }, 0);
        const noteOverflow = layerRect
          ? noteBoxes.reduce((total, box) => {
            const outsideLeft = Math.max(0, layerRect.x - box.x);
            const outsideTop = Math.max(0, layerRect.y - box.y);
            const outsideRight = Math.max(0, box.x + box.width - (layerRect.x + layerRect.width));
            const outsideBottom = Math.max(0, box.y + box.height - (layerRect.y + layerRect.height));
            return total + (outsideLeft + outsideRight) * box.height + (outsideTop + outsideBottom) * box.width;
          }, 0)
          : Number.POSITIVE_INFINITY;
        const legacyTitle = document.querySelector('.legacy-report-annotation .ui-annotation__title');
        const legacyConnector = document.querySelector('.legacy-report-annotation .ui-annotation__connector');
        const legacyConnectorEnd = document.querySelector('.legacy-report-annotation .ui-annotation__connector-end');
        const legacyBadge = document.querySelector('.legacy-report-annotation .ui-annotation__badge');
        const legacyEvidenceTitle = document.querySelector('.legacy-report-annotation .ui-annotation--evidence .ui-annotation__title');
        const legacySvg = document.querySelector('.legacy-report-annotation');
        const legacyTitleStyle = legacyTitle ? getComputedStyle(legacyTitle) : undefined;
        const legacyConnectorStyle = legacyConnector ? getComputedStyle(legacyConnector) : undefined;
        const legacyConnectorEndStyle = legacyConnectorEnd ? getComputedStyle(legacyConnectorEnd) : undefined;
        const legacyBadgeStyle = legacyBadge ? getComputedStyle(legacyBadge) : undefined;
        const legacyEvidenceTitleStyle = legacyEvidenceTitle ? getComputedStyle(legacyEvidenceTitle) : undefined;
        const legacySvgRect = legacySvg?.getBoundingClientRect();
        const reportAnnotation = document.querySelector('.report__annotations .pa-annotation[data-annotation-id="throughput"]');
        const reportConnector = reportAnnotation?.querySelector('.pa-annotation__connector');
        const reportSubject = reportAnnotation?.querySelector('.pa-annotation__subject');
        const reportNoteBox = reportAnnotation?.querySelector('.pa-annotation__note-box');
        const reportTitle = reportAnnotation?.querySelector('.pa-annotation__title');
        const reportAnnotationStyle = reportAnnotation ? getComputedStyle(reportAnnotation) : undefined;
        const reportConnectorStyle = reportConnector ? getComputedStyle(reportConnector) : undefined;
        const reportSubjectStyle = reportSubject ? getComputedStyle(reportSubject) : undefined;
        const reportNoteBoxStyle = reportNoteBox ? getComputedStyle(reportNoteBox) : undefined;
        const reportTitleStyle = reportTitle ? getComputedStyle(reportTitle) : undefined;
        const styledAnnotation = document.querySelector('g[data-annotation-id="peak"]');
        const styledConnector = styledAnnotation?.querySelector('.pa-annotation__connector');
        const styledSubject = styledAnnotation?.querySelector('.pa-annotation__subject');
        const styledNoteBox = styledAnnotation?.querySelector('.pa-annotation__note-box');
        const styledAnnotationStyle = styledAnnotation ? getComputedStyle(styledAnnotation) : undefined;
        const styledConnectorStyle = styledConnector ? getComputedStyle(styledConnector) : undefined;
        const styledSubjectStyle = styledSubject ? getComputedStyle(styledSubject) : undefined;
        const styledNoteBoxStyle = styledNoteBox ? getComputedStyle(styledNoteBox) : undefined;
        const bandAnnotation = document.querySelector('g[data-annotation-id="band"]');
        const bandSubject = bandAnnotation?.querySelector('.pa-annotation__subject');
        const bandSubjectStyle = bandSubject ? getComputedStyle(bandSubject) : undefined;
        const encircleAnnotation = document.querySelector('g[data-annotation-id="outlier-cluster"]');
        const encircleSubject = encircleAnnotation?.querySelector('.pa-annotation__subject');
        const encircleSubjectStyle = encircleSubject ? getComputedStyle(encircleSubject) : undefined;
        const firstNoteBox = noteBoxElements[0];
        const firstConnector = connectors.find((connector) => connector.getAttribute('d')?.trim()) ?? connectors[0];
        const firstSubject = document.querySelector('.pa-annotation__subject, .pa-annotation__badge');
        const firstTitle = document.querySelector('.pa-annotation__title:not(.pa-annotation__badge-label), .pa-annotation__title');
        const firstBadge = document.querySelector('.pa-annotation__badge');
        const firstBadgePointer = document.querySelector('.pa-annotation__badge-pointer');
        const firstBadgeLabel = document.querySelector('.pa-annotation__badge-label');
        const firstNoteBoxStyle = firstNoteBox ? getComputedStyle(firstNoteBox) : undefined;
        const firstConnectorStyle = firstConnector ? getComputedStyle(firstConnector) : undefined;
        const firstSubjectStyle = firstSubject ? getComputedStyle(firstSubject) : undefined;
        const firstTitleStyle = firstTitle ? getComputedStyle(firstTitle) : undefined;
        const firstBadgeStyle = firstBadge ? getComputedStyle(firstBadge) : undefined;
        const firstBadgePointerStyle = firstBadgePointer ? getComputedStyle(firstBadgePointer) : undefined;
        const firstBadgeLabelStyle = firstBadgeLabel ? getComputedStyle(firstBadgeLabel) : undefined;

        return {
          annotations: document.querySelectorAll('.pa-annotation').length,
          notes: notes.length,
          noteBoxes: noteBoxElements.length,
          connectors: connectors.filter((connector) => connector.getAttribute('d')?.trim()).length,
          visibleNotes: noteBoxes.filter((box) => box.width > 0 && box.height > 0).length,
          focusableNotes: focusableNotes.length,
          quality: exampleData?.quality,
          qualitySummary: exampleData?.qualitySummary ?? '',
          visibleConnectors: connectorBoxes.filter((box) => box.d.trim() && (box.width > 0 || box.height > 0)).length,
          subjects: document.querySelectorAll('.pa-annotation__subject').length,
          editHandles: document.querySelectorAll('.pa-annotation__edit-handle').length,
          layerBox: layer?.getBoundingClientRect().toJSON(),
          pageOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          bodyOverflowX: Math.max(0, document.body.scrollWidth - window.innerWidth),
          noteOverlapArea,
          obstacleBoxes: obstacleBoxes.length,
          noteObstacleOverlapArea,
          noteOverflow,
          legacyBrontoCss: {
            titleText: legacyTitle?.textContent ?? '',
            titleFill: legacyTitleStyle?.fill ?? '',
            titlePaintOrder: legacyTitleStyle?.paintOrder ?? '',
            titleStroke: legacyTitleStyle?.stroke ?? '',
            titleTextTransform: legacyTitleStyle?.textTransform ?? '',
            connectorStroke: legacyConnectorStyle?.stroke ?? '',
            connectorEndFill: legacyConnectorEndStyle?.fill ?? '',
            badgeFill: legacyBadgeStyle?.fill ?? '',
            badgeStroke: legacyBadgeStyle?.stroke ?? '',
            evidenceTitleFill: legacyEvidenceTitleStyle?.fill ?? '',
            evidenceTitleStroke: legacyEvidenceTitleStyle?.stroke ?? '',
            svgBox: legacySvgRect ? {
              x: legacySvgRect.x,
              y: legacySvgRect.y,
              width: legacySvgRect.width,
              height: legacySvgRect.height
            } : undefined
          },
          brontoPackageCss: {
            accent: reportAnnotationStyle?.getPropertyValue('--pa-annotation-accent').trim() ?? '',
            connectorStroke: reportConnectorStyle?.stroke ?? '',
            connectorStrokeWidth: reportConnectorStyle?.strokeWidth ?? '',
            subjectFill: reportSubjectStyle?.fill ?? '',
            subjectStroke: reportSubjectStyle?.stroke ?? '',
            noteFill: reportNoteBoxStyle?.fill ?? '',
            noteStroke: reportNoteBoxStyle?.stroke ?? '',
            titleFill: reportTitleStyle?.fill ?? '',
            titleFontWeight: reportTitleStyle?.fontWeight ?? ''
          },
          styleOverrides: {
            accent: styledAnnotationStyle?.getPropertyValue('--pa-annotation-accent').trim() ?? '',
            connectorStroke: styledConnectorStyle?.stroke ?? '',
            subjectFill: styledSubjectStyle?.fill ?? '',
            noteFill: styledNoteBoxStyle?.fill ?? '',
            noteBackground: styledNoteBoxStyle?.backgroundColor ?? '',
            bandSubjectClass: bandSubject?.getAttribute('class') ?? '',
            bandSubjectTransform: bandSubject?.getAttribute('transform') ?? '',
            bandSubjectD: bandSubject?.getAttribute('d') ?? '',
            bandSubjectFill: bandSubjectStyle?.fill ?? '',
            bandSubjectStroke: bandSubjectStyle?.stroke ?? '',
            bandSubjectStrokeDasharray: bandSubjectStyle?.strokeDasharray ?? '',
            encircleSubjectClass: encircleSubject?.getAttribute('class') ?? '',
            encircleSubjectTransform: encircleSubject?.getAttribute('transform') ?? '',
            encircleSubjectD: encircleSubject?.getAttribute('d') ?? '',
            encircleSubjectFill: encircleSubjectStyle?.fill ?? '',
            encircleSubjectStroke: encircleSubjectStyle?.stroke ?? '',
            encircleSubjectStrokeDasharray: encircleSubjectStyle?.strokeDasharray ?? ''
          },
          packageStyleHealth: {
            noteBoxStyled: Boolean(firstNoteBoxStyle
              && (visibleColor(firstNoteBoxStyle.backgroundColor) || visibleColor(firstNoteBoxStyle.fill))
              && (visibleColor(firstNoteBoxStyle.borderColor)
                || visibleColor(firstNoteBoxStyle.stroke)
                || positiveCssNumber(firstNoteBoxStyle.borderTopWidth))),
            connectorStyled: Boolean(firstConnectorStyle
              && visibleColor(firstConnectorStyle.stroke)
              && positiveCssNumber(firstConnectorStyle.strokeWidth)),
            subjectStyled: !firstSubjectStyle || Boolean(
              visibleColor(firstSubjectStyle.stroke)
              || visibleColor(firstSubjectStyle.fill)
            ),
            titleStyled: Boolean(firstTitleStyle
              && (visibleColor(firstTitleStyle.color) || visibleColor(firstTitleStyle.fill))
              && positiveCssNumber(firstTitleStyle.fontSize)),
            badgeStyled: !firstBadgeStyle || Boolean(
              visibleColor(firstBadgeStyle.fill)
              && visibleColor(firstBadgeStyle.stroke)
            ),
            badgePointerStyled: !firstBadgePointerStyle || Boolean(
              visibleColor(firstBadgePointerStyle.fill)
              && visibleColor(firstBadgePointerStyle.stroke)
            ),
            badgeLabelStyled: !firstBadgeLabelStyle || Boolean(
              (visibleColor(firstBadgeLabelStyle.color) || visibleColor(firstBadgeLabelStyle.fill))
              && positiveCssNumber(firstBadgeLabelStyle.fontSize)
            ),
            noteBackground: firstNoteBoxStyle?.backgroundColor ?? '',
            noteFill: firstNoteBoxStyle?.fill ?? '',
            noteStroke: firstNoteBoxStyle?.stroke ?? '',
            noteBorderColor: firstNoteBoxStyle?.borderColor ?? '',
            connectorStroke: firstConnectorStyle?.stroke ?? '',
            connectorStrokeWidth: firstConnectorStyle?.strokeWidth ?? '',
            subjectStroke: firstSubjectStyle?.stroke ?? '',
            subjectFill: firstSubjectStyle?.fill ?? '',
            titleColor: firstTitleStyle?.color ?? '',
            titleFill: firstTitleStyle?.fill ?? '',
            titleFontSize: firstTitleStyle?.fontSize ?? '',
            badgeFill: firstBadgeStyle?.fill ?? '',
            badgeStroke: firstBadgeStyle?.stroke ?? '',
            badgePointerFill: firstBadgePointerStyle?.fill ?? '',
            badgePointerStroke: firstBadgePointerStyle?.stroke ?? '',
            badgeLabelColor: firstBadgeLabelStyle?.color ?? '',
            badgeLabelFill: firstBadgeLabelStyle?.fill ?? '',
            badgeLabelFontSize: firstBadgeLabelStyle?.fontSize ?? ''
          },
          exampleData
        };

        function isFiniteBox(box) {
          return box
            && Number.isFinite(box.x)
            && Number.isFinite(box.y)
            && Number.isFinite(box.width)
            && Number.isFinite(box.height)
            && box.width >= 0
            && box.height >= 0;
        }

        function overlapArea(box, other) {
          const left = Math.max(box.x, other.x);
          const right = Math.min(box.x + box.width, other.x + other.width);
          const top = Math.max(box.y, other.y);
          const bottom = Math.min(box.y + box.height, other.y + other.height);
          const width = right - left;
          const height = bottom - top;

          return width > 0 && height > 0 ? width * height : 0;
        }

        function mapSvgBoxToClient(box, svg, svgRect, viewBox) {
          const preserveAspectRatio = svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet';

          if (preserveAspectRatio.includes('none')) {
            const scaleX = svgRect.width / viewBox.width;
            const scaleY = svgRect.height / viewBox.height;

            return {
              x: svgRect.x + (box.x - viewBox.x) * scaleX,
              y: svgRect.y + (box.y - viewBox.y) * scaleY,
              width: box.width * scaleX,
              height: box.height * scaleY
            };
          }

          const scaleX = svgRect.width / viewBox.width;
          const scaleY = svgRect.height / viewBox.height;
          const scale = preserveAspectRatio.includes('slice')
            ? Math.max(scaleX, scaleY)
            : Math.min(scaleX, scaleY);
          const renderedWidth = viewBox.width * scale;
          const renderedHeight = viewBox.height * scale;
          const offsetX = svgRect.x + alignedOffset(svgRect.width - renderedWidth, preserveAspectRatio, 'x');
          const offsetY = svgRect.y + alignedOffset(svgRect.height - renderedHeight, preserveAspectRatio, 'y');

          return {
            x: offsetX + (box.x - viewBox.x) * scale,
            y: offsetY + (box.y - viewBox.y) * scale,
            width: box.width * scale,
            height: box.height * scale
          };
        }

        function alignedOffset(extra, preserveAspectRatio, axis) {
          if (axis === 'x') {
            if (preserveAspectRatio.includes('xMin')) {
              return 0;
            }

            if (preserveAspectRatio.includes('xMax')) {
              return extra;
            }
          }

          if (axis === 'y') {
            if (preserveAspectRatio.includes('YMin')) {
              return 0;
            }

            if (preserveAspectRatio.includes('YMax')) {
              return extra;
            }
          }

          return extra / 2;
        }

        function visibleColor(value) {
          if (!value || value === 'none' || value === 'transparent') {
            return false;
          }

          return !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value)
            && !/color\(.*\/\s*0\s*\)/i.test(value);
        }

        function positiveCssNumber(value) {
          return Number.parseFloat(value || '0') > 0;
        }
      });

      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        throw new Error(`${label} emitted browser errors: ${[...consoleErrors, ...pageErrors].join('\\n')}`);
      }

      if (evidence.annotations < 1 || evidence.notes < 1 || evidence.connectors < 1) {
        throw new Error(`${label} did not render a usable annotation layer: ${JSON.stringify(evidence)}`);
      }

      if (evidence.visibleNotes !== evidence.notes || evidence.visibleConnectors < 1) {
        throw new Error(`${label} has invisible note or connector geometry: ${JSON.stringify(evidence)}`);
      }

      if (evidence.focusableNotes < 1) {
        throw new Error(`${label} did not render a keyboard-focusable annotation note: ${JSON.stringify(evidence)}`);
      }

      if (evidence.quality?.ok !== true || typeof evidence.qualitySummary !== 'string' || !evidence.qualitySummary.includes(': ok')) {
        throw new Error(`${label} did not expose a passing package layout-quality report: ${JSON.stringify(evidence)}`);
      }

      if (evidence.noteOverlapArea > 1) {
        throw new Error(`${label} rendered overlapping notes: ${JSON.stringify(evidence)}`);
      }

      if (example.minObstacles && evidence.obstacleBoxes < example.minObstacles) {
        throw new Error(`${label} did not expose enough host obstacles: ${JSON.stringify(evidence)}`);
      }

      if (example.minEditHandles && evidence.editHandles < example.minEditHandles) {
        throw new Error(`${label} did not render expected edit handles: ${JSON.stringify(evidence)}`);
      }

      if (evidence.obstacleBoxes > 0 && evidence.noteObstacleOverlapArea > 1) {
        throw new Error(`${label} rendered notes over host obstacles: ${JSON.stringify(evidence)}`);
      }

      if (evidence.noteOverflow > 1) {
        throw new Error(`${label} rendered notes outside the annotation layer: ${JSON.stringify(evidence)}`);
      }

      if (!evidence.layerBox || evidence.layerBox.width <= 0 || evidence.layerBox.height <= 0) {
        throw new Error(`${label} annotation layer has an empty box.`);
      }

      if (evidence.pageOverflowX > 1 || evidence.bodyOverflowX > 1) {
        throw new Error(`${label} created horizontal page overflow: ${JSON.stringify({
          pageOverflowX: evidence.pageOverflowX,
          bodyOverflowX: evidence.bodyOverflowX,
          layerBox: evidence.layerBox
        })}`);
      }

      if (!evidence.packageStyleHealth?.noteBoxStyled
        || !evidence.packageStyleHealth?.connectorStyled
        || !evidence.packageStyleHealth?.titleStyled
        || !evidence.packageStyleHealth?.subjectStyled
        || !evidence.packageStyleHealth?.badgeStyled
        || !evidence.packageStyleHealth?.badgePointerStyled
        || !evidence.packageStyleHealth?.badgeLabelStyled) {
        throw new Error(`${label} did not apply usable package annotation styling: ${JSON.stringify(evidence.packageStyleHealth)}`);
      }

      if (example.hostLayerSelector) {
        const hostLayer = page.locator(example.hostLayerSelector).first();
        const hostLayerCount = await hostLayer.count();

        if (hostLayerCount < 1) {
          throw new Error(`${label} did not render host layer ${example.hostLayerSelector}.`);
        }

        const hostLayerBox = await hostLayer.evaluate((element) => {
          const rect = element.getBoundingClientRect();

          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          };
        });
        const layerBox = evidence.layerBox;
        const mismatch =
          Math.abs(hostLayerBox.x - layerBox.x)
          + Math.abs(hostLayerBox.y - layerBox.y)
          + Math.abs(hostLayerBox.width - layerBox.width)
          + Math.abs(hostLayerBox.height - layerBox.height);

        if (mismatch > 2) {
          throw new Error(`${label} host SVG and annotation layer are not aligned: ${JSON.stringify({
            hostLayerSelector: example.hostLayerSelector,
            hostLayerBox,
            layerBox
          })}`);
        }
      }

      if (example.source && evidence.exampleData?.anchorSource !== example.source) {
        throw new Error(`${label} expected source ${example.source}, got ${evidence.exampleData?.anchorSource}`);
      }

      if (example.verifyViewportTransform && evidence.exampleData?.viewportTransformActive !== true) {
        throw new Error(`${label} did not prove a transformed generated-surface viewport: ${JSON.stringify(evidence.exampleData)}`);
      }

      if (example.minRendered && Number(evidence.exampleData?.[example.minRendered] ?? 0) < 1) {
        throw new Error(`${label} did not report rendered host geometry: ${JSON.stringify(evidence.exampleData)}`);
      }

      if (example.minRenderedSvgObstacles && Number(evidence.exampleData?.renderedSvgObstacles ?? 0) < example.minRenderedSvgObstacles) {
        throw new Error(`${label} did not report rendered SVG obstacles: ${JSON.stringify(evidence.exampleData)}`);
      }

      if (example.minGeneratedObstacles && Number(evidence.exampleData?.generatedObstacles ?? 0) < example.minGeneratedObstacles) {
        throw new Error(`${label} did not report generated obstacles: ${JSON.stringify(evidence.exampleData)}`);
      }

      if (example.minCandidates && Number(evidence.exampleData?.minCandidates ?? 0) < example.minCandidates) {
        throw new Error(`${label} did not report enough placement candidates: ${JSON.stringify(evidence.exampleData)}`);
      }

      if (example.requiredEvidence) {
        const anchorEvidence = Array.isArray(evidence.exampleData?.anchorEvidence)
          ? evidence.exampleData.anchorEvidence
          : [];
        const missingEvidence = example.requiredEvidence.filter((required) => {
          return !anchorEvidence.some((actual) => Object.entries(required).every(([key, value]) => actual?.[key] === value));
        });

        if (missingEvidence.length > 0) {
          throw new Error(`${label} did not prove generated adapter anchors: ${JSON.stringify({
            missingEvidence,
            anchorEvidence,
            exampleData: evidence.exampleData
          })}`);
        }
      }

      if (example.validateAnchors) {
        const validation = evidence.exampleData?.validation;
        const missing = Array.isArray(validation?.missing) ? validation.missing : [];
        const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];

        if (validation?.ok !== true || missing.length > 0 || warnings.length > 0) {
          throw new Error(`${label} did not validate adapter targets: ${JSON.stringify({
            validation,
            exampleData: evidence.exampleData
          })}`);
        }
      }

      if (example.validateTargetAlignment) {
        const targetAlignment = evidence.exampleData?.targetAlignment;
        const missing = Array.isArray(targetAlignment?.missing) ? targetAlignment.missing : [];
        const warnings = Array.isArray(targetAlignment?.warnings) ? targetAlignment.warnings : [];
        const summary = evidence.exampleData?.targetAlignmentSummary;

        if (targetAlignment?.ok !== true
          || missing.length > 0
          || warnings.length > 0
          || typeof summary !== 'string'
          || !summary.includes(': ok')) {
          throw new Error(`${label} did not expose clean generated target alignment diagnostics: ${JSON.stringify({
            targetAlignment,
            targetAlignmentSummary: summary,
            exampleData: evidence.exampleData
          })}`);
        }
      }

      if (example.requiredSelectors) {
        for (const selector of example.requiredSelectors) {
          const count = await page.locator(selector).count();

          if (count < 1) {
            throw new Error(`${label} did not render required host selector ${selector}: ${JSON.stringify(evidence.exampleData)}`);
          }
        }
      }

      if (example.anchorTargetChecks) {
        for (const check of example.anchorTargetChecks) {
          const targetEvidence = await page.evaluate((input) => {
            const annotation = document.querySelector(`.pa-annotation[data-annotation-id="${cssStringEscape(input.annotationId)}"]`);
            const subject = annotation?.querySelector('.pa-annotation__subject');
            const target = findTarget(input);

            return {
              annotationId: input.annotationId,
              selector: input.selector,
              text: input.text,
              subjectFound: Boolean(subject),
              targetFound: Boolean(target),
              subjectBox: subject ? clientBox(subject) : undefined,
              targetBox: target ? clientBox(target) : undefined
            };

            function findTarget(targetInput) {
              const candidates = Array.from(document.querySelectorAll(targetInput.selector));
              const filtered = targetInput.text
                ? candidates.filter((element) => normalizeText(element.textContent ?? '') === normalizeText(targetInput.text))
                : candidates;

              return filtered[targetInput.index ?? 0];
            }

            function clientBox(element) {
              const rect = element.getBoundingClientRect();

              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              };
            }

            function normalizeText(value) {
              return value.replace(/\s+/g, ' ').trim();
            }

            function cssStringEscape(value) {
              return String(value).replace(/["\\]/g, '\\$&');
            }
          }, check);

          const subjectBox = targetEvidence.subjectBox;
          const targetBox = targetEvidence.targetBox;

          if (!targetEvidence.subjectFound || !targetEvidence.targetFound || !subjectBox || !targetBox) {
            throw new Error(`${label} could not prove annotation target geometry: ${JSON.stringify(targetEvidence)}`);
          }

          const centerDistance = distance(center(subjectBox), center(targetBox));
          const maxCenterDistance = check.maxCenterDistance ?? 8;

          if (centerDistance > maxCenterDistance) {
            throw new Error(`${label} annotation subject is not aligned to rendered target geometry: ${JSON.stringify({
              ...targetEvidence,
              centerDistance,
              maxCenterDistance
            })}`);
          }
        }
      }

      if (example.verifyLegacyBrontoCss) {
        const legacy = evidence.legacyBrontoCss;
        const styled = legacy?.titleText === 'Legacy'
          && legacy.svgBox?.width > 0
          && legacy.svgBox?.height > 0
          && legacy.titlePaintOrder.includes('stroke')
          && legacy.titleTextTransform === 'uppercase'
          && legacy.titleStroke !== ''
          && legacy.titleStroke !== 'none'
          && legacy.connectorStroke !== ''
          && legacy.connectorStroke !== 'none'
          && legacy.connectorEndFill !== ''
          && legacy.connectorEndFill !== 'none'
          && legacy.badgeFill !== ''
          && legacy.badgeFill !== 'none'
          && legacy.badgeStroke !== ''
          && legacy.badgeStroke !== 'none'
          && legacy.evidenceTitleFill !== ''
          && legacy.evidenceTitleFill !== 'none'
          && (legacy.evidenceTitleStroke === '' || legacy.evidenceTitleStroke === 'none');

        if (!styled) {
          throw new Error(`${label} did not render legacy Bronto annotation CSS: ${JSON.stringify(legacy)}`);
        }
      }

      if (example.verifyBrontoPackageCss) {
        const pkgStyle = evidence.brontoPackageCss;
        const styled = pkgStyle?.connectorStroke === 'rgb(15, 118, 110)'
          && pkgStyle.connectorStrokeWidth !== ''
          && Number.parseFloat(pkgStyle.connectorStrokeWidth) > 0
          && pkgStyle.subjectStroke === 'rgb(15, 118, 110)'
          && pkgStyle.subjectFill !== ''
          && pkgStyle.subjectFill !== 'none'
          && pkgStyle.subjectFill !== 'rgba(37, 99, 235, 0.1)'
          && pkgStyle.noteFill === 'rgb(255, 255, 255)'
          && pkgStyle.noteStroke === 'rgb(204, 215, 227)'
          && pkgStyle.titleFill === 'rgb(17, 24, 39)'
          && Number.parseFloat(pkgStyle.titleFontWeight) >= 700;

        if (!styled) {
          throw new Error(`${label} did not apply Bronto tokens to generated package annotation CSS: ${JSON.stringify(pkgStyle)}`);
        }
      }

      if (example.verifyStyle) {
        const styles = evidence.styleOverrides;
        const styled = styles?.accent === '#d12f6a'
          && styles.connectorStroke === 'rgb(209, 47, 106)'
          && styles.subjectFill === 'rgba(209, 47, 106, 0.14)'
          && (styles.noteFill === 'rgb(255, 247, 251)' || styles.noteBackground === 'rgb(255, 247, 251)')
          && styles.bandSubjectClass.includes('pa-annotation__subject--geometry')
          && styles.bandSubjectD === 'M228,172H350V258H228Z'
          && styles.bandSubjectTransform === ''
          && styles.bandSubjectFill !== ''
          && styles.bandSubjectFill !== 'none'
          && styles.bandSubjectStroke !== ''
          && styles.bandSubjectStroke !== 'none'
          && styles.bandSubjectStrokeDasharray !== ''
          && styles.bandSubjectStrokeDasharray !== 'none'
          && styles.encircleSubjectClass.includes('pa-annotation__subject--geometry-encircle')
          && styles.encircleSubjectD === evidence.exampleData?.encircleSubjectPath
          && styles.encircleSubjectTransform === ''
          && styles.encircleSubjectFill !== ''
          && styles.encircleSubjectFill !== 'none'
          && styles.encircleSubjectStroke !== ''
          && styles.encircleSubjectStroke !== 'none'
          && (styles.encircleSubjectStrokeDasharray === '' || styles.encircleSubjectStrokeDasharray === 'none');

        if (!styled) {
          throw new Error(`${label} did not apply per-annotation style overrides: ${JSON.stringify(styles)}`);
        }
      }

      if (example.verifyStyleGallery) {
        await verifyStyleGallery(page, label);
      }

      if (example.verifyExamplesIndex) {
        await verifyExamplesIndex(page, label);
      }

      if (example.verifyMotionMedia) {
        await verifyMotionMedia(page, label);
      }

      if (example.verifyForcedColors) {
        await verifyForcedColors(page, label);
      }

      if (example.verifyEditDrag) {
        await verifyEditDrag(page, label);
      }

      if (example.verifyReactFlowEditDrag) {
        await verifyReactFlowEditDrag(page, label);
      }

      await page.screenshot({
        path: resolve(screenshotsDir, viewport.name === 'desktop'
          ? `${example.name}.png`
          : `${example.name}-${viewport.name}.png`),
        fullPage: true
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

async function verifyReactFlowEditDrag(page, label) {
  const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="flow-review"]').first();
  const handleBox = await handle.boundingBox();
  const before = await page.evaluate(() => {
    const note = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box');
    const exampleData = window.__annotationsExample;
    const review = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'flow-review')
      : undefined;
    const rect = note?.getBoundingClientRect();

    return {
      viewport: exampleData?.viewport,
      viewportTransformActive: exampleData?.viewportTransformActive,
      noteBox: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : undefined,
      manual: review?.manual
    };
  });

  if (!handleBox || !before.noteBox || before.viewportTransformActive !== true) {
    throw new Error(`${label} could not locate transformed editable React Flow note handle: ${JSON.stringify({ handleBox, before })}`);
  }

  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2
  };
  const delta = { x: 14, y: 10 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 4 });
  await page.mouse.up();

  await page.waitForFunction(() => {
    const lastEdit = window.__annotationsLastEdit;
    const exampleData = window.__annotationsExample;
    const review = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'flow-review')
      : undefined;

    return lastEdit?.annotationId === 'flow-review'
      && lastEdit.phase === 'end'
      && lastEdit.manual
      && review?.manual
      && Array.isArray(exampleData?.editPatchIds)
      && exampleData.editPatchIds.includes('flow-review');
  }, null, { timeout: 5000 });

  const after = await page.evaluate(() => {
    const note = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box');
    const rect = note?.getBoundingClientRect();
    const exampleData = window.__annotationsExample;
    const review = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'flow-review')
      : undefined;

    return {
      lastEdit: window.__annotationsLastEdit,
      editPatchIds: exampleData?.editPatchIds,
      viewport: exampleData?.viewport,
      noteBox: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : undefined,
      manual: review?.manual
    };
  });
  const moved = after.noteBox
    && (Math.abs(after.noteBox.x - before.noteBox.x) > 2 || Math.abs(after.noteBox.y - before.noteBox.y) > 2);

  if (!after.lastEdit?.manual || !after.manual || !moved) {
    throw new Error(`${label} did not persist a React Flow annotation edit through host patch state: ${JSON.stringify({ before, after })}`);
  }
}

async function verifyMotionMedia(page, label) {
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  const animated = await page.evaluate(annotationMotionState);

  if (!animated.drawConnectorAnimation.includes('paAnnotationDraw')
    || !animated.pulseSubjectAnimation.includes('paAnnotationPulse')) {
    throw new Error(`${label} did not enable annotation motion under no-preference: ${JSON.stringify(animated)}`);
  }

  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  const reduced = await page.evaluate(annotationMotionState);

  if (reduced.drawConnectorAnimation !== 'none' || reduced.pulseSubjectAnimation !== 'none') {
    throw new Error(`${label} did not disable annotation motion under reduced-motion: ${JSON.stringify(reduced)}`);
  }

  await page.emulateMedia({ media: 'print', reducedMotion: 'no-preference' });
  const print = await page.evaluate(annotationMotionState);

  if (print.drawConnectorAnimation !== 'none'
    || print.drawConnectorDashoffset !== '0px'
    || !print.drawNoteTransform?.startsWith('translate(')) {
    throw new Error(`${label} did not keep print-safe annotation motion/placement: ${JSON.stringify(print)}`);
  }

  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
}

async function verifyStyleGallery(page, label) {
  const required = {
    variants: [
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
    ],
    tones: ['accent', 'muted', 'success', 'warning', 'danger', 'info'],
    motions: ['draw', 'reveal', 'pulse', 'focus']
  };
  const gallery = await page.evaluate((input) => {
    const data = window.__annotationsExample;
    const visible = (value) => value
      && value !== 'none'
      && value !== 'transparent'
      && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value);
    const missingVariantClasses = input.variants.filter((variant) => !document.querySelector(`.pa-annotation--${variant}`));
    const missingToneClasses = input.tones.filter((tone) => !document.querySelector(`.pa-annotation--${tone}`));
    const missingMotionClasses = input.motions.filter((motion) => !document.querySelector(`.pa-annotation--${motion}`));
    const noteBoxes = Array.from(document.querySelectorAll('.pa-annotation__note-box'));
    const subjects = Array.from(document.querySelectorAll('.pa-annotation__subject, .pa-annotation__badge'));
    const connectors = Array.from(document.querySelectorAll('.pa-annotation__connector'));
    const unstyledNotes = noteBoxes.filter((noteBox) => {
      const style = getComputedStyle(noteBox);

      return !visible(style.fill) && !visible(style.backgroundColor);
    }).length;
    const unstyledSubjects = subjects.filter((subject) => {
      const style = getComputedStyle(subject);

      return !visible(style.stroke) && !visible(style.fill);
    }).length;
    const unstyledConnectors = connectors.filter((connector) => {
      const style = getComputedStyle(connector);

      return !visible(style.stroke) || Number.parseFloat(style.strokeWidth || '0') <= 0;
    }).length;

    return {
      name: data?.name,
      variants: data?.variants,
      tones: data?.tones,
      motions: data?.motions,
      renderedVariants: data?.renderedVariants,
      classEvidence: data?.classEvidence,
      missingVariantClasses,
      missingToneClasses,
      missingMotionClasses,
      noteBoxes: noteBoxes.length,
      subjects: subjects.length,
      connectors: connectors.length,
      unstyledNotes,
      unstyledSubjects,
      unstyledConnectors
    };
  }, required);

  const ok = gallery.name === 'style-gallery'
    && gallery.renderedVariants === required.variants.length
    && Array.isArray(gallery.variants)
    && required.variants.every((variant) => gallery.variants.includes(variant))
    && required.tones.every((tone) => gallery.tones?.includes(tone))
    && required.motions.every((motion) => gallery.motions?.includes(motion))
    && gallery.missingVariantClasses.length === 0
    && gallery.missingToneClasses.length === 0
    && gallery.missingMotionClasses.length === 0
    && gallery.noteBoxes >= required.variants.length
    && gallery.subjects >= required.variants.length
    && gallery.connectors >= required.variants.length - 1
    && gallery.unstyledNotes === 0
    && gallery.unstyledSubjects === 0
    && gallery.unstyledConnectors === 0;

  if (!ok) {
    throw new Error(`${label} did not render the full annotation style gallery: ${JSON.stringify(gallery)}`);
  }
}

async function verifyExamplesIndex(page, label) {
  const requiredExamples = examples
    .map((example) => example.name)
    .filter((name) => name !== 'index');
  const index = await page.evaluate((required) => {
    const data = window.__annotationsExample;
    const anchors = Array.from(document.querySelectorAll('.example-links a')).map((anchor) => {
      return {
        text: normalizeText(anchor.textContent ?? ''),
        href: anchor.getAttribute('href') ?? '',
        resolvedPath: new URL(anchor.href).pathname
      };
    });
    const missingLinks = required.filter((name) => !anchors.some((anchor) => anchor.resolvedPath.includes(`/examples/${name}/`)));
    const missingMetadata = required.filter((name) => !data?.links?.includes(name));

    return {
      name: data?.name,
      linkCount: anchors.length,
      links: data?.links,
      anchors,
      missingLinks,
      missingMetadata
    };

    function normalizeText(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  }, requiredExamples);

  const ok = index.name === 'examples-index'
    && index.linkCount === requiredExamples.length
    && Array.isArray(index.links)
    && index.links.length === requiredExamples.length
    && index.missingLinks.length === 0
    && index.missingMetadata.length === 0;

  if (!ok) {
    throw new Error(`${label} did not link every verified example context: ${JSON.stringify({
      requiredExamples,
      index
    })}`);
  }
}

async function verifyForcedColors(page, label) {
  await page.emulateMedia({ media: 'screen', forcedColors: 'active', reducedMotion: 'no-preference' });
  const forced = await page.evaluate(() => {
    const annotation = document.querySelector('.pa-annotation');
    const noteBox = document.querySelector('.pa-annotation__note-box');
    const connector = document.querySelector('.pa-annotation__connector');
    const subject = document.querySelector('.pa-annotation__subject');
    const title = document.querySelector('.pa-annotation__title:not(.pa-annotation__badge-label), .pa-annotation__title');
    const annotationStyle = annotation ? getComputedStyle(annotation) : undefined;
    const noteBoxStyle = noteBox ? getComputedStyle(noteBox) : undefined;
    const connectorStyle = connector ? getComputedStyle(connector) : undefined;
    const subjectStyle = subject ? getComputedStyle(subject) : undefined;
    const titleStyle = title ? getComputedStyle(title) : undefined;

    return {
      active: matchMedia('(forced-colors: active)').matches,
      accentVar: annotationStyle?.getPropertyValue('--pa-annotation-accent').trim() ?? '',
      paperVar: annotationStyle?.getPropertyValue('--pa-annotation-paper').trim() ?? '',
      borderVar: annotationStyle?.getPropertyValue('--pa-annotation-border').trim() ?? '',
      noteFill: noteBoxStyle?.fill ?? '',
      noteBackground: noteBoxStyle?.backgroundColor ?? '',
      connectorStroke: connectorStyle?.stroke ?? '',
      subjectStroke: subjectStyle?.stroke ?? '',
      subjectFill: subjectStyle?.fill ?? '',
      titleFill: titleStyle?.fill ?? '',
      titleColor: titleStyle?.color ?? ''
    };
  });

  const visible = (value) => value
    && value !== 'none'
    && value !== 'transparent'
    && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value);
  const ok = forced.active
    && forced.accentVar === 'CanvasText'
    && forced.paperVar === 'Canvas'
    && forced.borderVar === 'CanvasText'
    && (visible(forced.noteFill) || visible(forced.noteBackground))
    && visible(forced.connectorStroke)
    && (visible(forced.subjectStroke) || visible(forced.subjectFill))
    && (visible(forced.titleFill) || visible(forced.titleColor));

  if (!ok) {
    throw new Error(`${label} did not apply forced-colors annotation styling: ${JSON.stringify(forced)}`);
  }

  await page.emulateMedia({ media: 'screen', forcedColors: 'none', reducedMotion: 'no-preference' });
}

function annotationMotionState() {
  const drawConnector = document.querySelector('.pa-annotation--draw .pa-annotation__connector');
  const drawNote = document.querySelector('.pa-annotation--draw .pa-annotation__note');
  const pulseSubject = document.querySelector('.pa-annotation--pulse :is(.pa-annotation__subject, .pa-annotation__badge)');
  const drawConnectorStyle = drawConnector ? getComputedStyle(drawConnector) : undefined;
  const pulseSubjectStyle = pulseSubject ? getComputedStyle(pulseSubject) : undefined;

  return {
    drawConnectorFound: Boolean(drawConnector),
    pulseSubjectFound: Boolean(pulseSubject),
    drawConnectorAnimation: drawConnectorStyle?.animationName ?? '',
    drawConnectorDashoffset: drawConnectorStyle?.strokeDashoffset ?? '',
    drawNoteTransform: drawNote?.getAttribute('transform') ?? '',
    pulseSubjectAnimation: pulseSubjectStyle?.animationName ?? ''
  };
}

async function verifyEditDrag(page, label) {
  const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="queue"]').first();
  const handleBox = await handle.boundingBox();
  const before = await page.evaluate(() => {
    const note = document.querySelector('g[data-annotation-id="queue"] .pa-annotation__note-box');
    const exampleData = window.__annotationsExample;
    const queue = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'queue')
      : undefined;
    const rect = note?.getBoundingClientRect();

    return {
      noteBox: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : undefined,
      manual: queue?.manual
    };
  });

  if (!handleBox || !before.noteBox) {
    throw new Error(`${label} could not locate editable note handle: ${JSON.stringify({ handleBox, before })}`);
  }

  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2
  };
  const delta = { x: 24, y: 14 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 4 });
  await page.mouse.up();

  await page.waitForFunction(() => {
    const lastEdit = window.__annotationsLastEdit;
    const exampleData = window.__annotationsExample;
    const queue = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'queue')
      : undefined;

    return lastEdit?.annotationId === 'queue'
      && lastEdit.phase === 'end'
      && lastEdit.manual
      && queue?.manual;
  }, null, { timeout: 5000 });

  const after = await page.evaluate(() => {
    const note = document.querySelector('g[data-annotation-id="queue"] .pa-annotation__note-box');
    const rect = note?.getBoundingClientRect();
    const exampleData = window.__annotationsExample;
    const queue = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'queue')
      : undefined;

    return {
      lastEdit: window.__annotationsLastEdit,
      noteBox: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : undefined,
      manual: queue?.manual
    };
  });
  const moved = after.noteBox
    && (Math.abs(after.noteBox.x - before.noteBox.x) > 2 || Math.abs(after.noteBox.y - before.noteBox.y) > 2);

  if (!after.lastEdit?.manual || !after.manual || !moved) {
    throw new Error(`${label} did not persist an edit drag through host state: ${JSON.stringify({ before, after })}`);
  }

  const anchorBefore = await page.evaluate(() => {
    const exampleData = window.__annotationsExample;
    const decision = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'decision')
      : undefined;

    return {
      anchor: decision?.anchor
    };
  });
  const anchorHandle = page.locator('.pa-annotation__edit-handle--anchor[data-annotation-id="decision"]').first();

  await anchorHandle.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForFunction(() => {
    const lastEdit = window.__annotationsLastEdit;
    const exampleData = window.__annotationsExample;
    const decision = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'decision')
      : undefined;

    return lastEdit?.annotationId === 'decision'
      && lastEdit.phase === 'end'
      && lastEdit.anchor
      && decision?.anchor;
  }, null, { timeout: 5000 });

  const anchorAfter = await page.evaluate(() => {
    const exampleData = window.__annotationsExample;
    const decision = Array.isArray(exampleData?.annotations)
      ? exampleData.annotations.find((annotation) => annotation.id === 'decision')
      : undefined;

    return {
      lastEdit: window.__annotationsLastEdit,
      anchor: decision?.anchor
    };
  });
  const beforePoint = anchorBefore.anchor?.point;
  const afterPoint = anchorAfter.anchor?.point;
  const keyboardMoved = beforePoint
    && afterPoint
    && afterPoint.x > beforePoint.x
    && afterPoint.y === beforePoint.y;

  if (!anchorAfter.lastEdit?.anchor || !keyboardMoved) {
    throw new Error(`${label} did not persist a keyboard anchor edit through host state: ${JSON.stringify({
      anchorBefore,
      anchorAfter
    })}`);
  }
}

function center(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function formatBrowserErrors(consoleErrors, pageErrors) {
  const errors = [...consoleErrors, ...pageErrors];

  return errors.length > 0
    ? ` Browser errors:\n${errors.join('\n')}`
    : '';
}

function distance(point, other) {
  return Math.hypot(point.x - other.x, point.y - other.y);
}
