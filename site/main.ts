import {
  evaluateAnnotationLayout,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type Box,
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import './site.css';
import { DEFAULT_PLAYGROUND_STATE, parseSceneHash, sceneUrl, type PlaygroundState } from './playground-state.js';

const form = document.querySelector<HTMLFormElement>('#annotation-controls');
const notesInput = document.querySelector<HTMLInputElement>('#notes-count');
const obstacleInput =
  document.querySelector<HTMLInputElement>('#obstacle-size');
const routeInput = document.querySelector<HTMLSelectElement>('#route-style');
const placementInput = document.querySelector<HTMLSelectElement>('#placement-mode');
const placementNote = document.querySelector<HTMLElement>('#placement-mode-note');
const overlay = document.querySelector<HTMLElement>('#annotation-overlay');
const obstacleRect = document.querySelector<SVGRectElement>('#plot-obstacle');
const countOutput = document.querySelector<HTMLOutputElement>('#notes-display');
const obstacleOutput =
  document.querySelector<HTMLOutputElement>('#obstacle-display');
const scoreOutput = document.querySelector<HTMLElement>('#layout-score');
const placedOutput = document.querySelector<HTMLElement>('#placed-count');
const overlapOutput = document.querySelector<HTMLElement>('#overlap-count');
const obstacleOverlapOutput = document.querySelector<HTMLElement>('#obstacle-overlap-count');
const plotModeLabel = document.querySelector<HTMLElement>('#plot-mode-label');
const comparisonResult = document.querySelector<HTMLElement>('#comparison-result');
const scenePresetHint = document.querySelector<HTMLElement>('#scene-preset-hint');
const sceneSourceCode = document.querySelector<HTMLElement>('#scene-source-code code');
const sceneLink = document.querySelector<HTMLInputElement>('#scene-link');
const shareButton = document.querySelector<HTMLButtonElement>('#copy-scene-link');
const shareStatus = document.querySelector<HTMLElement>('#scene-link-status');
const comparisonToggle = document.querySelector<HTMLButtonElement>('#toggle-placement');
const scenePresetButtons = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-scene]'),
];

const bounds: Box = { x: 0, y: 0, width: 760, height: 430 };
const points = [
  { x: 193, y: 244, title: 'Baseline', body: 'Steady response', tone: 'info' },
  {
    x: 343,
    y: 209,
    title: 'Transition',
    body: 'New signal detected',
    tone: 'accent',
  },
  {
    x: 506,
    y: 156,
    title: 'Rising trend',
    body: 'Sustained movement',
    tone: 'success',
  },
  {
    x: 645,
    y: 94,
    title: 'Peak signal',
    body: 'Outside baseline',
    tone: 'accent',
  },
  {
    x: 380,
    y: 319,
    title: 'Region of interest',
    body: 'Review context',
    tone: 'warning',
  },
] as const;

// These presets configure the actual engine inputs, not precomputed drawings.
const scenePresets = {
  balanced: { count: 3, width: 150, route: 'orthogonal', description: 'Balanced: three callouts and a medium obstacle.' },
  crowded: { count: 5, width: 215, route: 'orthogonal', description: 'Crowded: five callouts compete for space around a wide obstacle.' },
  sparse: { count: 2, width: 80, route: 'none', description: 'Open space: two callouts and a smaller obstacle with direct connectors.' },
} as const;

function updateLayout() {
  if (
    !notesInput ||
    !obstacleInput ||
    !routeInput ||
    !placementInput ||
    !placementNote ||
    !overlay ||
    !obstacleRect ||
    !countOutput ||
    !obstacleOutput ||
    !scoreOutput ||
    !placedOutput ||
    !overlapOutput ||
    !obstacleOverlapOutput ||
    !plotModeLabel ||
    !comparisonResult ||
    !scenePresetHint ||
    !sceneSourceCode
  )
    return;

  const count = Math.min(5, Math.max(2, Math.round(Number(notesInput.value) || 3)));
  const width = Math.min(215, Math.max(80, Math.round((Number(obstacleInput.value) || 150) / 5) * 5));
  const routing = routeInput.value === 'none' ? 'none' : 'orthogonal';
  const placementMode = placementInput.value === 'fixed' ? 'fixed' : 'automatic';
  if (sceneLink) sceneLink.value = sceneUrl(window.location.href, {
    notes: count, obstacle: width, routing, placement: placementMode,
  });
  if (comparisonToggle) {
    comparisonToggle.textContent = placementMode === 'fixed' ? 'Show automatic placement' : 'Compare fixed offsets';
    comparisonToggle.setAttribute('aria-pressed', String(placementMode === 'fixed'));
  }
  const obstacle: Box = { x: 350, y: 219, width, height: 90 };
  obstacleRect.setAttribute('width', String(width));
  countOutput.textContent = String(count);
  obstacleOutput.textContent = String(width);

  const activePreset = (Object.keys(scenePresets) as Array<keyof typeof scenePresets>)
    .find((key) => {
      const preset = scenePresets[key];
      return preset.count === count && preset.width === width && preset.route === routing;
    });
  for (const button of scenePresetButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.scene === activePreset));
  }
  scenePresetHint.textContent = activePreset
    ? scenePresets[activePreset].description + ' Change any control to experiment.'
    : 'Custom scene: your callout count, obstacle width and connector routing. Choose a preset to restore a starting point.';

  const makeAnnotations = (mode: 'automatic' | 'fixed'): Annotation[] =>
    points.slice(0, count).map((point, i) => ({
      id: 'demo-' + i,
      anchor: { type: 'point', point: { x: point.x, y: point.y } },
      note: { title: point.title, body: point.body, wrap: 22, maxLines: 2 },
      // Both versions go through the exact same resolver and quality evaluator.
      // Fixed offsets are illustrative manual placements, not another engine.
      placement: mode === 'fixed'
        ? { manual: { x: point.x + 18, y: point.y - 24, side: 'right' as const } }
        : { side: i % 2 ? 'left' as const : 'right' as const },
      connector: { type: 'elbow', end: 'dot', routing },
      variant: 'callout',
      tone: point.tone,
      priority: count - i,
    }));

  const resolveScene = (annotations: Annotation[]) =>
    resolveAnnotationLayout({
      annotations,
      bounds,
      padding: 22,
      obstacles: [obstacle],
      noteSizes: Object.fromEntries(annotations.map((a) => [a.id, { width: 158, height: 67 }])),
      refinement: { passes: 2, maxCandidatesPerAnnotation: 32 },
    });

  const automatic = resolveScene(makeAnnotations('automatic'));
  const fixed = resolveScene(makeAnnotations('fixed'));
  const layouts = { automatic, fixed };
  const layout = layouts[placementMode];
  const quality = evaluateAnnotationLayout(layout);
  const automaticQuality = evaluateAnnotationLayout(automatic);
  const fixedQuality = evaluateAnnotationLayout(fixed);

  // Fixed, trusted source data. The SVG renderer handles its own markup.
  overlay.innerHTML = renderAnnotationsSvg(layout, {
    title: 'Computed chart annotations',
    markerIdPrefix: 'bronto-site-playground',
    noteTabIndex: 0,
    preserveAspectRatio: 'xMidYMid meet',
  });
  scoreOutput.textContent = String(Math.round(quality.score));
  placedOutput.textContent = String(layout.annotations.length);
  overlapOutput.textContent =
    quality.metrics.noteOverlapArea === 0
      ? 'None'
      : String(Math.round(quality.metrics.noteOverlapArea)) + ' units²';
  obstacleOverlapOutput.textContent =
    quality.metrics.obstacleOverlapArea === 0
      ? 'None'
      : String(Math.round(quality.metrics.obstacleOverlapArea)) + ' units²';
  plotModeLabel.textContent = placementMode === 'fixed'
    ? 'FIXED OFFSETS'
    : 'COLLISION-AWARE';
  placementNote.textContent = placementMode === 'fixed'
    ? 'Illustrative baseline: each note stays 18 units right and 24 units above its anchor, measured in chart coordinates. No collision-aware candidate search is used.'
    : 'Collision-aware placement searches multiple candidates around notes and obstacles. The metrics below come from the resolved geometry.';

  const totalOverlap = (metrics: typeof quality.metrics) =>
    metrics.noteOverlapArea + metrics.obstacleOverlapArea;
  const automaticArea = totalOverlap(automaticQuality.metrics);
  const fixedArea = totalOverlap(fixedQuality.metrics);
  const difference = Math.round(fixedArea - automaticArea);
  const scoreComparison =
    ' Layout scores: automatic ' + Math.round(automaticQuality.score) +
    ', fixed ' + Math.round(fixedQuality.score) + '.';
  if (difference > 0) {
    comparisonResult.textContent =
      'Collision-aware placement reduces combined overlap by ' + difference +
      ' chart units² versus fixed offsets.' + scoreComparison;
  } else if (difference < 0) {
    comparisonResult.textContent =
      'For these inputs, fixed offsets have ' + Math.abs(difference) +
      ' fewer chart units² of combined overlap. Try a different scene.' + scoreComparison;
  } else {
    comparisonResult.textContent =
      'Both methods have the same measured combined overlap for this scene.' + scoreComparison;
  }

  const annotations = makeAnnotations(placementMode);
  sceneSourceCode.textContent = [
    "import { resolveAnnotationLayout, renderAnnotationsSvg, type Annotation } from '@ponchia/annotations';",
    "import '@ponchia/annotations/bronto.css';",
    '',
    '// Add <div id="chart-annotations"></div> to your HTML, inside your chart container.',
    '// Coordinates and note dimensions use the same layout units as this scene.',
    'const annotations: Annotation[] = ' + JSON.stringify(annotations, null, 2) + ';',
    'const layout = resolveAnnotationLayout({',
    '  annotations,',
    '  bounds: { x: 0, y: 0, width: 760, height: 430 },',
    '  padding: 22,',
    '  obstacles: [' + JSON.stringify(obstacle) + '],',
    '  noteSizes: Object.fromEntries(annotations.map(note => [note.id, { width: 158, height: 67 }])),',
    '  refinement: { passes: 2, maxCandidatesPerAnnotation: 32 },',
    '});',
    "const svg = renderAnnotationsSvg(layout, {",
    "  title: 'Chart notes',",
    "  noteTabIndex: 0,",
    "  preserveAspectRatio: 'xMidYMid meet',",
    "});",
    "const target = document.getElementById('chart-annotations');",
    "if (!target) throw new Error('Missing #chart-annotations mount');",
    "target.innerHTML = svg;",
    "// Use trusted annotation content; the host owns any additional input validation.",
  ].join('\n');

  overlay.dataset.mode = placementMode;
  overlay.dataset.noteOverlap = String(Math.round(quality.metrics.noteOverlapArea));
  overlay.dataset.obstacleOverlap = String(Math.round(quality.metrics.obstacleOverlapArea));
  overlay.dataset.placed = String(layout.annotations.length);
  overlay.dataset.route = routing;
  overlay.dataset.score = String(Math.round(quality.score));
  overlay.dataset.scene = activePreset ?? 'custom';
}

for (const button of scenePresetButtons) {
  button.addEventListener('click', () => {
    const preset = scenePresets[button.dataset.scene as keyof typeof scenePresets];
    if (!preset || !notesInput || !obstacleInput || !routeInput) return;
    notesInput.value = String(preset.count);
    obstacleInput.value = String(preset.width);
    routeInput.value = preset.route;
    updateLayout();
  });
}

function applyState(state: PlaygroundState) {
  if (!notesInput || !obstacleInput || !routeInput || !placementInput) return;
  notesInput.value = String(state.notes);
  obstacleInput.value = String(state.obstacle);
  routeInput.value = state.routing;
  placementInput.value = state.placement;
}

function restoreSceneHash(): boolean {
  const parsed = parseSceneHash(window.location.hash);
  if (parsed.kind === 'unrelated') return false;
  applyState(parsed.kind === 'scene' ? parsed.state : DEFAULT_PLAYGROUND_STATE);
  if (shareStatus) shareStatus.textContent = parsed.kind === 'scene'
    ? 'Shared scene restored. The link below follows your current settings.'
    : 'This scene link is invalid or uses an unsupported version. Default settings restored.';
  return true;
}

comparisonToggle?.addEventListener('click', () => {
  if (!placementInput) return;
  placementInput.value = placementInput.value === 'fixed' ? 'automatic' : 'fixed';
  updateLayout();
});

shareButton?.addEventListener('click', async () => {
  if (!sceneLink || !shareStatus) return;
  // Capture the clicked state; changing controls while the permission prompt
  // is open must not change the link that this copy operation refers to.
  const link = sceneLink.value;
  try {
    await navigator.clipboard.writeText(link);
    shareStatus.textContent = 'Scene link copied. It restores the settings shown when you clicked.';
  } catch {
    sceneLink.focus();
    sceneLink.select();
    shareStatus.textContent = 'Clipboard unavailable. The scene link is selected for manual copying.';
  }
});

// Enter in the read-only link must not navigate or submit the surrounding form.
form?.addEventListener('submit', (event) => event.preventDefault());
window.addEventListener('hashchange', () => {
  if (restoreSceneHash()) updateLayout();
});
const restoredFromLink = restoreSceneHash();
form?.addEventListener('input', updateLayout);
form?.addEventListener('change', updateLayout);
// Native form reset restores the input defaults after the reset event returns.
form?.addEventListener('reset', () => requestAnimationFrame(() => {
  if (shareStatus) shareStatus.textContent = 'Default scene restored. Copy its link below.';
  updateLayout();
}));
updateLayout();
if (restoredFromLink) {
  requestAnimationFrame(() => document.getElementById('playground')?.scrollIntoView());
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-copy],[data-copy-target]',
)) {
  button.addEventListener('click', async () => {
    const targetId = button.dataset.copyTarget;
    const original = button.textContent;
    const content = targetId
      ? (document.getElementById(targetId)?.textContent ?? '')
      : (button.dataset.copy ?? '');
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = original;
      }, 1500);
    } catch {
      button.textContent = 'Select and copy';
      setTimeout(() => {
        button.textContent = original;
      }, 1800);
    }
  });
}
