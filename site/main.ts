import {
  evaluateAnnotationLayout,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type Box,
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';
import './site.css';

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
    !plotModeLabel
  )
    return;

  const count = Math.min(5, Math.max(2, Number(notesInput.value) || 3));
  const width = Math.min(215, Math.max(80, Number(obstacleInput.value) || 150));
  const routing = routeInput.value === 'none' ? 'none' : 'orthogonal';
  const placementMode = placementInput.value === 'fixed' ? 'fixed' : 'automatic';
  const obstacle: Box = { x: 350, y: 219, width, height: 90 };
  obstacleRect.setAttribute('width', String(width));
  countOutput.textContent = String(count);
  obstacleOutput.textContent = String(width);

  const annotations: Annotation[] = points.slice(0, count).map((point, i) => ({
    id: 'demo-' + i,
    anchor: { type: 'point', point: { x: point.x, y: point.y } },
    note: { title: point.title, body: point.body, wrap: 22, maxLines: 2 },
    // The illustrative baseline always places the note at the same offset
    // from its anchor. Both modes use the *same engine and quality evaluator*;
    // only the placement recipe differs. This is not a comparison with a
    // competing layout library or its actual algorithm.
    placement: placementMode === 'fixed'
      ? {
          manual: {
            x: point.x + 18,
            y: point.y - 24,
            side: 'right' as const,
          },
        }
      : { side: i % 2 ? 'left' as const : 'right' as const },
    connector: { type: 'elbow', end: 'dot', routing },
    variant: 'callout',
    tone: point.tone,
    priority: count - i,
  }));

  const layout = resolveAnnotationLayout({
    annotations,
    bounds,
    padding: 22,
    obstacles: [obstacle],
    noteSizes: Object.fromEntries(
      annotations.map((a) => [a.id, { width: 158, height: 67 }]),
    ),
    refinement: { passes: 2, maxCandidatesPerAnnotation: 32 },
  });
  const quality = evaluateAnnotationLayout(layout);
  // This is a fixed, trusted illustration, not a string from an external user.
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
      : String(Math.round(quality.metrics.noteOverlapArea)) + 'px²';
  obstacleOverlapOutput.textContent =
    quality.metrics.obstacleOverlapArea === 0
      ? 'None'
      : String(Math.round(quality.metrics.obstacleOverlapArea)) + 'px²';
  plotModeLabel.textContent = placementMode === 'fixed'
    ? 'FIXED OFFSETS'
    : 'COLLISION-AWARE';
  placementNote.textContent = placementMode === 'fixed'
    ? 'Illustrative baseline: each note stays 18 units right and 24 units above its anchor. No collision-aware candidate search is used.'
    : 'Collision-aware placement searches multiple candidates around notes and obstacles. The metrics below come from the resolved geometry.';
  overlay.dataset.mode = placementMode;
  overlay.dataset.noteOverlap = String(Math.round(quality.metrics.noteOverlapArea));
  overlay.dataset.obstacleOverlap = String(Math.round(quality.metrics.obstacleOverlapArea));
  overlay.dataset.placed = String(layout.annotations.length);
  overlay.dataset.route = routing;
  overlay.dataset.score = String(Math.round(quality.score));
}

form?.addEventListener('input', updateLayout);
form?.addEventListener('change', updateLayout);
// Native form reset restores the input defaults after the reset event returns.
form?.addEventListener('reset', () => requestAnimationFrame(updateLayout));
updateLayout();

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
