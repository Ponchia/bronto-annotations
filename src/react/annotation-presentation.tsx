import { memo } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import { dataAttributes, annotationStyle } from './render-data.js';
import { renderSubject, renderConnector, renderDebugBoxes } from './svg-annotation-parts.js';
import { editHandlePosition } from './edit-geometry.js';
import type { AnnotationEditHandle } from '../core/edit.js';
import type { Annotation, AnnotationNoteLineOptions, ResolvedAnnotation } from '../core/model.js';
import type { AnnotationLayerProps } from './types.js';

// Drag previews update one resolved annotation. Memoized paint boundaries keep
// React from reconstructing note content, host renderNote callbacks, and edit
// controls for every untouched neighbor on each pointer event.
export const PaintedAnnotation = memo(function PaintedAnnotation({
  item,
  prefix,
  markerPrefix,
  debug,
  noteTabIndex,
  renderNote
}: {
  item: ResolvedAnnotation;
  prefix: string;
  markerPrefix: string;
  debug: boolean;
  noteTabIndex: AnnotationLayerProps['noteTabIndex'];
  renderNote: AnnotationLayerProps['renderNote'];
}) {
  return (
    <g
      className={[
        prefix,
        `${prefix}--${item.placement.side}`,
        item.placement.manual ? `${prefix}--manual` : undefined,
        item.annotation.variant ? `${prefix}--${item.annotation.variant}` : undefined,
        item.annotation.tone ? `${prefix}--${item.annotation.tone}` : undefined,
        item.annotation.motion ? `${prefix}--${item.annotation.motion}` : undefined,
        item.annotation.className
      ].filter(Boolean).join(' ')}
      data-annotation-id={item.id}
      data-annotation-side={item.placement.side}
      role="group"
      aria-label={item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id}
      style={annotationStyle(item.annotation.style)}
      {...dataAttributes(item.annotation.data)}
    >
      {renderSubject(item, prefix)}
      {renderConnector(item, prefix, markerPrefix)}
      {item.annotation.note.visible === false ? null : (
        <foreignObject
          className={noteShellClass(prefix, item.annotation)}
          x={item.noteBox.x}
          y={item.noteBox.y}
          width={item.noteBox.width}
          height={item.noteBox.height}
          data-note-align={item.annotation.note.align ?? 'start'}
        >
          <div
            className={noteBoxClass(prefix, item.annotation)}
            role="note"
            aria-label={item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id}
            tabIndex={noteTabIndex}
            {...dataAttributes(item.annotation.note.data)}
            data-annotation-id={item.id}
            data-note-align={item.annotation.note.align ?? 'start'}
          >
            {renderNote ? renderNote(item) : <DefaultNote annotation={item.annotation} classPrefix={prefix} />}
          </div>
        </foreignObject>
      )}
      {debug ? renderDebugBoxes(item, prefix) : null}
    </g>
  );
});

export const PaintedEditHandle = memo(function PaintedEditHandle({
  handle,
  prefix,
  tabIndex,
  onPointerDown,
  onKeyDown,
  onLostPointerCapture
}: {
  handle: AnnotationEditHandle;
  prefix: string;
  tabIndex: number;
  onPointerDown: (handle: AnnotationEditHandle, event: ReactPointerEvent<SVGCircleElement>) => void;
  onKeyDown: (handle: AnnotationEditHandle, event: ReactKeyboardEvent<SVGCircleElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <g
      className={`${prefix}__edit-handle-group ${prefix}__edit-handle-group--${handle.kind}`}
      data-annotation-id={handle.annotationId}
      data-edit-handle={handle.kind}
      data-edit-handle-position={editHandlePosition(handle)}
    >
      <circle
        aria-hidden="true"
        className={`${prefix}__edit-hit ${prefix}__edit-hit--${handle.kind}`}
        cx={handle.point.x}
        cy={handle.point.y}
        r={handle.hitRadius}
        data-edit-handle-position={editHandlePosition(handle)}
        style={{ cursor: handle.cursor }}
        onPointerDown={(event) => onPointerDown(handle, event)}
        onLostPointerCapture={onLostPointerCapture}
      />
      <circle
        aria-label={handle.ariaLabel}
        className={`${prefix}__edit-handle ${prefix}__edit-handle--${handle.kind}`}
        cx={handle.point.x}
        cy={handle.point.y}
        data-annotation-id={handle.annotationId}
        data-edit-handle={handle.kind}
        data-edit-handle-position={editHandlePosition(handle)}
        r={handle.radius}
        role="button"
        style={{ cursor: handle.cursor }}
        tabIndex={tabIndex}
        aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Shift+ArrowUp Shift+ArrowRight Shift+ArrowDown Shift+ArrowLeft"
        onKeyDown={(event) => onKeyDown(handle, event)}
        onPointerDown={(event) => onPointerDown(handle, event)}
        onLostPointerCapture={onLostPointerCapture}
      />
    </g>
  );
});

export const MeasuredAnnotation = memo(function MeasuredAnnotation({
  item,
  prefix,
  renderNote,
  setMeasureNode
}: {
  item: ResolvedAnnotation;
  prefix: string;
  renderNote: AnnotationLayerProps['renderNote'];
  setMeasureNode: (id: string, node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      className={noteBoxClass(prefix, item.annotation)}
      ref={(node) => setMeasureNode(item.id, node)}
      data-note-align={item.annotation.note.align ?? 'start'}
      // The drawn note inherits the annotation's style variables from
      // its <g>; the measured copy has no such parent, so without
      // these its `border: 1px solid var(--pa-annotation-border)`
      // computed to no border at all and every note measured 2px
      // narrower than the box it was then drawn in — which is how a
      // title that fit the measurer wrapped at the drawn box's edge.
      style={annotationStyle(item.annotation.style)}
      {...dataAttributes(item.annotation.note.data)}
    >
      {renderNote ? renderNote(item) : <DefaultNote annotation={item.annotation} classPrefix={prefix} />}
    </div>
  );
});

function DefaultNote({ annotation, classPrefix }: { annotation: Annotation; classPrefix: string }) {
  const line = normalizeNoteLine(annotation.note.line);
  const lineOrientation = line?.orientation ?? 'horizontal';

  return (
    <>
      {line ? (
        <span
          aria-hidden="true"
          className={[
            `${classPrefix}__note-line`,
            `${classPrefix}__note-line--${lineOrientation}`,
            line.className
          ].filter(Boolean).join(' ')}
          data-note-line="true"
          data-note-line-orientation={lineOrientation}
          style={noteLineStyle(line)}
          {...dataAttributes(line.data)}
        />
      ) : null}
      {annotation.note.title ? <strong className={`${classPrefix}__title`}>{annotation.note.title}</strong> : null}
      {annotation.note.body ? <span className={`${classPrefix}__body ${classPrefix}__label`}>{annotation.note.body}</span> : null}
    </>
  );
}

function noteLineStyle(line: AnnotationNoteLineOptions): CSSProperties | undefined {
  if (line.length === undefined) {
    return undefined;
  }

  return line.orientation === 'vertical'
    ? { blockSize: line.length }
    : { inlineSize: line.length };
}

function normalizeNoteLine(line: Annotation['note']['line']): AnnotationNoteLineOptions | undefined {
  if (line === undefined || line === false) {
    return undefined;
  }

  if (line === true) {
    return {};
  }

  return line.visible === false ? undefined : line;
}

function noteShellClass(prefix: string, annotation: Annotation): string {
  return [
    `${prefix}__note`,
    `${prefix}__note--align-${annotation.note.align ?? 'start'}`
  ].join(' ');
}

function noteBoxClass(prefix: string, annotation: Annotation): string {
  return [
    `${prefix}__note-box`,
    `${prefix}__note-box--align-${annotation.note.align ?? 'start'}`,
    annotation.note.className
  ].filter(Boolean).join(' ');
}

