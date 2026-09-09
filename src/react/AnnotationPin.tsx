import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { Point } from '../core/model.js';

export type AnnotationPinProps = {
  point: Point;
  label: string;
  children?: ReactNode;
  selected?: boolean;
  controls?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
};

/** A keyboard/touch target in the host's overlay; it owns no thread state. */
export function AnnotationPin({ point, label, children, selected, controls, onClick, className, style }: AnnotationPinProps) {
  return <button
    type="button"
    className={['pa-annotation-pin', className].filter(Boolean).join(' ')}
    aria-label={label}
    aria-pressed={selected}
    aria-controls={controls}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); onClick?.(event); }}
    style={{ ...style, position: 'absolute', left: point.x, top: point.y }}
  >{children ?? '•'}</button>;
}
