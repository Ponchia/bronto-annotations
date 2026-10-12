import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  type Annotation,
  type Box,
  type ResolvedAnnotation
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EDITOR_MAX_NOTES, parseEditorAnnotationJson } from './json-import.js';
import { appendDemoNote, removeFinalNote, moveFinalNoteAnchor } from './note-actions.js';
import { editAnnotationText } from './note-text-editor.js';
import { NoteTextEditor } from './NoteTextEditor.js';
import { noteIdFromCanvasTarget } from './note-selection.js';
import {
  createEditorHistory, pushEditorHistory, undoEditorHistory, redoEditorHistory,
  type EditorHistory
} from './editor-history.js';
import './styles.css';

// Everything here belongs to the host. The annotation library owns the
// placement engine and SVG layer; it does not own graph state or persistence.
const bounds: Box = { x: 0, y: 0, width: 860, height: 500 };
const obstacles: Box[] = [
  { x: 102, y: 210, width: 170, height: 80 },
  { x: 350, y: 210, width: 170, height: 80 },
  { x: 598, y: 210, width: 170, height: 80 }
];
const noteSizes: Record<string, { width: number; height: number }> = {
  intake: { width: 144, height: 72 },
  triage: { width: 165, height: 74 },
  delivery: { width: 174, height: 74 },
  signal: { width: 164, height: 74 },
  added: { width: 150, height: 70 }
};
const initialAnnotations: Annotation[] = [
  {
    id: 'intake', priority: 4,
    anchor: { type: 'box', box: obstacles[0]! },
    note: { title: 'Intake', body: 'Source geometry stays fixed.' },
    placement: { manual: { x: 70, y: 92, side: 'top' } }
  },
  {
    id: 'triage', priority: 3,
    anchor: { type: 'box', box: obstacles[1]! },
    note: { title: 'Triage', body: 'Previous placements can be reused.' },
    placement: { manual: { x: 354, y: 354, side: 'bottom' } }
  },
  {
    id: 'delivery', priority: 2,
    anchor: { type: 'box', box: obstacles[2]! },
    note: { title: 'Delivery', body: 'One authoritative resolved layout.' },
    placement: { manual: { x: 620, y: 92, side: 'top' } }
  },
  {
    id: 'signal', priority: 1,
    anchor: { type: 'point', point: { x: 435, y: 248 } },
    note: { title: 'Live marker', body: 'Move this anchor or drag the note.' },
    placement: { manual: { x: 307, y: 83, side: 'top' } }
  }
];

function optionsFor(annotations: Annotation[]) {
  return { annotations, bounds, obstacles, padding: 16, noteSizes, refinement: false as const };
}

type DemoView = {
  annotations: Annotation[];
  layout: ReturnType<typeof createIncrementalAnnotationLayoutSession>['layout'];
  reused: number;
  action: string;
  changes: number;
  undoCount: number;
  redoCount: number;
};

function noteContent(item: ResolvedAnnotation) {
  return (
    <>
      <strong className="pa-annotation__title">{item.annotation.note.title}</strong>
      <span className="pa-annotation__body pa-annotation__label">{item.annotation.note.body}</span>
    </>
  );
}

function App() {
  const session = useRef<ReturnType<typeof createIncrementalAnnotationLayoutSession> | null>(null);
  if (!session.current) session.current = createIncrementalAnnotationLayoutSession(optionsFor(initialAnnotations));
  const history = useRef<EditorHistory | null>(null);
  if (!history.current) history.current = createEditorHistory(initialAnnotations);
  const [selectedNoteId, setSelectedNoteId] = useState('signal');
  const [view, setView] = useState<DemoView>(() => ({
    annotations: initialAnnotations,
    layout: session.current!.layout,
    reused: 0,
    action: 'Initial layout',
    changes: 0,
    undoCount: 0,
    redoCount: 0
  }));
  const quality = useMemo(() => evaluateAnnotationLayout(view.layout), [view.layout]);
  // Expose just the host-authored inputs, not the large candidate/quality
  // graph. This stays independent of package serialization or persistence.
  const annotationJson = useMemo(
    () => JSON.stringify(view.annotations, null, 2),
    [view.annotations]
  );
  const [copyStatus, setCopyStatus] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const atNoteLimit = view.annotations.length >= EDITOR_MAX_NOTES;
  const canRemoveLastNote = view.annotations.length > 1;
  const selectedTextNote = view.annotations.find((item) => item.id === selectedNoteId)
    ?? view.annotations[0]!;

  // Only authoritative edits enter this history: a pointer-move preview
  // remains visual-only and does not create a user-visible undo step.
  // The imported source, history and layout session remain host-owned.
  function commit(nextAnnotations: Annotation[], action: string) {
    const current = history.current!;
    const recorded = pushEditorHistory(current, nextAnnotations, action);
    if (recorded === current) {
      // Reset at the initial scene is still a meaningful UI acknowledgement.
      // Do not create an undo entry, rerun the solver or discard redo when
      // the authoritative input graph was already identical.
      setCopyStatus('');
      setImportError('');
      setImportStatus('');
      setView((last) => last.action === action ? last : { ...last, action });
      return;
    }
    const previous = session.current!.layout;
    const next = session.current!.update(optionsFor(nextAnnotations));
    const oldById = new Map(previous.annotations.map((item) => [item.id, item]));
    const reused = next.annotations.filter((item) => oldById.get(item.id) === item).length;
    history.current = recorded;
    setCopyStatus('');
    setImportError('');
    setImportStatus('');
    setView((last) => ({
      annotations: recorded.present.annotations,
      layout: next,
      reused,
      action,
      changes: last.changes + 1,
      undoCount: recorded.past.length,
      redoCount: 0
    }));
  }

  function stepHistory(direction: 'undo' | 'redo') {
    const current = history.current!;
    const nextHistory = direction === 'undo'
      ? undoEditorHistory(current) : redoEditorHistory(current);
    if (current === nextHistory) return;
    // The same incremental resolver accepts earlier authored inputs; it
    // remains the authoritative layout and retains safe unaffected winners.
    const before = session.current!.layout;
    const next = session.current!.update(optionsFor(nextHistory.present.annotations));
    const oldById = new Map(before.annotations.map((item) => [item.id, item]));
    const reused = next.annotations.filter((item) => oldById.get(item.id) === item).length;
    history.current = nextHistory;
    setCopyStatus('');
    setImportError('');
    setImportStatus('');
    setView((last) => ({
      annotations: nextHistory.present.annotations,
      layout: next,
      reused,
      action: direction === 'undo'
        ? `Undid: ${current.present.action}`
        : `Redid: ${nextHistory.present.action}`,
      changes: last.changes + 1,
      undoCount: nextHistory.past.length,
      redoCount: nextHistory.future.length
    }));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      // Native input and contenteditable undo must stay local to the draft:
      // editing JSON must never silently undo an already-committed diagram.
      if (target instanceof Element && target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
      )) return;
      const key = event.key.toLowerCase();
      const direction = key === 'z' && !event.shiftKey ? 'undo'
        : (key === 'z' && event.shiftKey) || key === 'y' ? 'redo' : null;
      if (!direction) return;
      const current = history.current!;
      if (!(direction === 'undo' ? current.past.length : current.future.length)) return;
      event.preventDefault();
      stepHistory(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function copyAnnotations() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(annotationJson);
      setCopyStatus('Current annotations copied.');
    } catch {
      setCopyStatus('Clipboard unavailable here. Select and copy the JSON below.');
    }
  }

  function loadAnnotationJson() {
    try {
      // Parse first and construct a *new* host-owned session before changing
      // React state. A malformed input or failed resolution leaves the prior
      // editor and its authoritative geometry untouched.
      const nextAnnotations = parseEditorAnnotationJson(importText);
      const replacement = createIncrementalAnnotationLayoutSession(optionsFor(nextAnnotations));
      const nextHistory = pushEditorHistory(
        history.current!, nextAnnotations, `Imported ${nextAnnotations.length} annotations from JSON`
      );
      session.current = replacement;
      history.current = nextHistory;
      setImportError('');
      setImportStatus(`Loaded ${nextAnnotations.length} annotations. Continue editing or copy the updated JSON.`);
      setCopyStatus('');
      setView((last) => ({
        annotations: nextAnnotations,
        layout: replacement.layout,
        reused: 0,
        action: `Imported ${nextAnnotations.length} annotations from JSON`,
        changes: last.changes + 1,
        undoCount: nextHistory.past.length,
        redoCount: nextHistory.future.length
      }));
    } catch (error) {
      setImportStatus('');
      setImportError(error instanceof Error ? error.message : 'Unable to read annotations.');
    }
  }

  function editCurrentJson() {
    setImportText(annotationJson);
    setImportError('');
    setImportStatus('Current host inputs copied into the editor below. Change them, then load the JSON.');
  }

  function moveLastAnchor() {
    const previous = history.current!.present.annotations;
    const next = moveFinalNoteAnchor(previous);
    if (next === previous) return;
    commit(next, 'Moved the final anchor');
  }

  function addAnnotation() {
    const previous = history.current!.present.annotations;
    const next = appendDemoNote(previous);
    if (next === previous) return;
    commit(next, 'Appended an annotation');
  }

  function removeAnnotation() {
    const previous = history.current!.present.annotations;
    const next = removeFinalNote(previous);
    if (next === previous) return;
    commit(next, 'Removed the final note');
  }

  useEffect(() => {
    Object.assign(window, {
      __annotationsExample: {
        name: 'react-incremental',
        quality,
        qualitySummary: formatLayoutQualityReport(quality, { label: 'React incremental annotations' }),
        obstacles,
        action: view.action,
        reused: view.reused,
        changes: view.changes,
        undoCount: view.undoCount,
        redoCount: view.redoCount,
        annotations: view.layout.annotations.map((item) => ({
          id: item.id,
          anchor: item.annotation.anchor,
          manual: item.annotation.placement?.manual,
          noteBox: item.noteBox
        }))
      }
    });
  }, [quality, view]);

  return (
    <main className="demo-shell">
      <header className="demo-heading">
        <div>
          <p className="eyebrow">Bronto Annotations / React</p>
          <h1>Change one note. Keep the rest.</h1>
          <p className="intro">A host-controlled layout in practice. Drag the handles or change the graph; earlier placements stay put when they can.</p>
        </div>
        <a className="source-link" href="https://github.com/Ponchia/bronto-annotations/tree/main/examples/react-incremental">View example source <span aria-hidden="true">↗</span></a>
      </header>

      <section className="demo-card" aria-label="Live incremental annotation editor">
        <div className="toolbar" role="group" aria-label="Annotation editing actions">
          <button id="move-note" type="button" onClick={moveLastAnchor}
            title="Move the final annotation anchor, including after importing your own JSON">Move final anchor</button>
          <button id="append-note" type="button" onClick={addAnnotation}
            disabled={atNoteLimit}
            title={atNoteLimit ? `This demo supports at most ${EDITOR_MAX_NOTES} notes` : undefined}>Add annotation</button>
          <button id="remove-note" type="button" onClick={removeAnnotation}
            disabled={!canRemoveLastNote}>Remove final note</button>
          <button id="reset-note" type="button" onClick={() => commit(structuredClone(initialAnnotations), 'Reset to initial diagram')}>Reset</button>
          <button id="undo-edit" type="button" aria-keyshortcuts="Control+Z Meta+Z"
            disabled={view.undoCount === 0} onClick={() => stepHistory('undo')}>Undo</button>
          <button id="redo-edit" type="button" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            disabled={view.redoCount === 0} onClick={() => stepHistory('redo')}>Redo</button>
          <span className="history-shortcuts">Undo: Ctrl/⌘ Z · Redo: Ctrl/⌘ Shift Z</span>
        </div>
        <p className="scroll-hint">Swipe sideways to follow the diagram <span aria-hidden="true">↔</span></p>

        <div className="stage-scroll" tabIndex={0} aria-label="Scrollable diagram with editable annotations">
          <div className="workflow-stage"
            onClickCapture={(event) => {
              const id = noteIdFromCanvasTarget(event.target, event.currentTarget);
              if (id) setSelectedNoteId(id);
            }}
            onFocusCapture={(event) => {
              // A keyboard user can Tab directly to a note to select its text
              // for editing. Selecting a visual note never changes the
              // authoritative layout or adds an undo entry.
              const id = noteIdFromCanvasTarget(event.target, event.currentTarget);
              if (id) setSelectedNoteId(id);
            }}
          >
            <svg className="workflow-base" role="img" aria-label="Intake flows through Triage to Delivery" viewBox="0 0 860 500">
              <defs>
                <marker id="workflow-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0 0L6 3L0 6Z" fill="#83919e" />
                </marker>
              </defs>
              <path className="workflow-lane" d="M272 250H350 M520 250H598" markerEnd="url(#workflow-arrow)" />
              {obstacles.map((box, i) => (
                <g key={i} aria-hidden="true">
                  <rect className="workflow-node" x={box.x} y={box.y} width={box.width} height={box.height} rx="13" />
                  <text className="workflow-label" x={box.x + box.width / 2} y={box.y + box.height / 2 + 5} textAnchor="middle">
                    {['Intake', 'Triage', 'Delivery'][i]}
                  </text>
                </g>
              ))}
            </svg>
            <AnnotationLayer
              annotations={view.annotations}
              bounds={bounds}
              obstacles={obstacles}
              noteSizes={noteSizes}
              padding={16}
              refinement={false}
              resolvedLayout={view.layout}
              // The transparent hit circle is larger than the visible knob.
              // Under this demo's scaled mobile viewBox it still provides an
              // easily targetable touch area without covering the full stage.
              editable={{ includeAnchor: true, noteHandlePosition: 'bottom-right', hitRadius: 24 }}
              previewEdits
              noteTabIndex={0}
              renderNote={noteContent}
              onEditEnd={(event) => {
                if (!event.suggestedAnnotation) return;
                commit(history.current!.present.annotations.map((item) => item.id === event.annotationId
                  ? event.suggestedAnnotation! : item), `Edited ${event.annotationId} by dragging`);
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div className="metrics" aria-live="polite" aria-atomic="true">
          <div className="metric"><span>Current action</span><strong id="current-action">{view.action}</strong></div>
          <div className="metric"><span>Reused placements</span><strong id="reused-placements">{view.reused} / {view.layout.annotations.length}</strong></div>
          <div className="metric"><span>Visible annotations</span><strong id="annotation-count">{view.layout.annotations.length}</strong></div>
          <div className="metric"><span>Layout quality</span><strong id="quality-score">{quality.score} / 100</strong></div>
        </div>
        <NoteTextEditor
          key={`${selectedTextNote.id}/${view.changes}`}
          annotation={selectedTextNote}
          annotations={view.annotations}
          onSelect={setSelectedNoteId}
          onApply={(id, title, body) => {
            const next = editAnnotationText(history.current!.present.annotations, id, title, body);
            commit(next, `Edited ${id} text`);
          }}
        />
        <details className="annotation-source">
          <summary>Inspect current annotations (JSON)</summary>
          <p>These are the host-owned annotation inputs after committed edits.
            Resolved candidates and computed placements remain engine output.</p>
          <div className="annotation-source-actions">
            <button id="copy-annotations" type="button" onClick={() => void copyAnnotations()}>
              Copy current JSON
            </button>
            <span role="status" aria-live="polite" id="copy-status">{copyStatus}</span>
          </div>
          <pre id="annotation-json" tabIndex={0} aria-label="Current host annotation JSON">{annotationJson}</pre>

          <div className="annotation-import">
            <label htmlFor="annotation-import-input">Load annotation JSON into this example</label>
            <p id="annotation-import-help">Paste an exported annotation array or start with the current JSON.
              This demo accepts 1–{EDITOR_MAX_NOTES} notes with point/box anchors, note text and basic placement settings;
              other annotation features require validation in your own host application.
              Failed imports leave the current layout unchanged.</p>
            <textarea
              id="annotation-import-input"
              aria-describedby="annotation-import-help"
              aria-invalid={Boolean(importError)}
              spellCheck={false}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportError('');
                setImportStatus('');
              }}
              placeholder='[{"id":"my-note","anchor":{"type":"point","point":{"x":300,"y":100}},"note":{"title":"My note"}}]'
              rows={6}
            />
            <div className="annotation-import-actions">
              <button id="edit-current-json" type="button" onClick={editCurrentJson}>
                Edit current JSON
              </button>
              <button id="load-annotation-json" type="button" onClick={loadAnnotationJson}>
                Load into editor
              </button>
            </div>
            {importError ? (
              <p className="annotation-import-error" role="alert" id="annotation-import-error">{importError}</p>
            ) : null}
            <p className="annotation-import-status" role="status" aria-live="polite" id="annotation-import-status">{importStatus}</p>
          </div>
        </details>
      </section>
      <p className="footnote">The host commits an edit once, then passes its resolved layout back to React. Drag feedback is visual-only until release. Global geometry changes may still require a full resolution.</p>
    </main>
  );
}

const root = document.querySelector('#root');
if (root) createRoot(root).render(<App />);
