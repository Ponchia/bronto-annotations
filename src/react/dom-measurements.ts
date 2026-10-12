/**
 * Private DOM note measurement lifecycle. The visual layer owns its note
 * registry and React state; this module owns geometry reads, reconciliation,
 * ResizeObserver wiring and cleanup. No package export is introduced.
 */
import { useCallback, useEffect, useLayoutEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Annotation, Size } from '../core/model.js';
import type { AnnotationLayerProps } from './types.js';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

type NoteRegistry = { current: Map<string, HTMLDivElement> };
type MeasuredSizes = Record<string, Size>;

export function useMeasurementNodeRegistration(measureNodes: NoteRegistry) {
  return useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      measureNodes.current.set(id, node);
    } else {
      measureNodes.current.delete(id);
    }
  }, []);
}

export function useDomNoteMeasurementObserver({
  annotations, measure, renderNote, measureNodes, setMeasuredSizes
}: {
  annotations: Annotation[];
  measure: AnnotationLayerProps['measure'];
  renderNote: AnnotationLayerProps['renderNote'];
  measureNodes: NoteRegistry;
  setMeasuredSizes: Dispatch<SetStateAction<MeasuredSizes>>;
}) {
  useIsomorphicLayoutEffect(() => {
    if (measure !== 'dom') {
      return undefined;
    }

    // Initial mount or a changed annotation collection must measure all
    // visible notes, including added/removed ones. ResizeObserver callbacks
    // have a much narrower meaning: only their listed elements changed.
    // Scanning every note on a one-note resize creates O(n) forced geometry
    // reads and computed-style lookups in dense DOM-measured editors.
    const measureNode = (node: HTMLDivElement): Size | undefined => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;

      // getBoundingClientRect reports post-transform pixels: under a scaled
      // ancestor, use computed local border-box dimensions for layout units.
      // Keep the client rect fallback for headless/test DOMs returning "auto".
      const style = typeof globalThis.getComputedStyle === 'function'
        ? globalThis.getComputedStyle(node)
        : undefined;
      const localWidth = style ? Number.parseFloat(style.width) : Number.NaN;
      const localHeight = style ? Number.parseFloat(style.height) : Number.NaN;
      return {
        width: Math.ceil(Number.isFinite(localWidth) && localWidth > 0 ? localWidth : rect.width),
        height: Math.ceil(Number.isFinite(localHeight) && localHeight > 0 ? localHeight : rect.height)
      };
    };

    const updateAll = () => {
      const next: Record<string, Size> = {};
      for (const [id, node] of measureNodes.current.entries()) {
        const size = measureNode(node);
        if (size) next[id] = size;
      }
      setMeasuredSizes((current) => shallowSizesEqual(current, next) ? current : next);
    };

    updateAll();
    if (typeof globalThis.ResizeObserver === 'undefined') return undefined;

    // The observer owns the actual node->ID mapping. Do not rely on DOM IDs
    // or class names, which custom note renderers are free to override.
    const idsByNode = new Map<Element, string>();
    // A queued callback can run after an annotation collection or renderer
    // switch tears down the old observer. Never read detached notes or commit
    // stale sizes from that previous generation of the measurer.
    let active = true;
    const observer = new globalThis.ResizeObserver((entries) => {
      if (!active) return;
      const changed = new Set<string>();
      for (const entry of entries) {
        const id = idsByNode.get(entry.target);
        if (id) changed.add(id);
      }
      if (changed.size === 0) return;

      const updates = new Map<string, Size | undefined>();
      for (const id of changed) {
        const node = measureNodes.current.get(id);
        if (node && idsByNode.get(node) === id) updates.set(id, measureNode(node));
      }
      if (updates.size === 0) return;
      setMeasuredSizes((current) => {
        let next: Record<string, Size> | undefined;
        for (const [id, size] of updates) {
          const previous = current[id];
          if (size) {
            if (previous?.width === size.width && previous.height === size.height) continue;
            next ??= { ...current };
            next[id] = size;
          } else if (previous) {
            next ??= { ...current };
            delete next[id];
          }
        }
        return next ?? current;
      });
    });
    for (const [id, node] of measureNodes.current.entries()) {
      idsByNode.set(node, id);
      observer.observe(node);
    }
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [annotations, measure, renderNote]);
}

function shallowSizesEqual(a: Record<string, Size>, b: Record<string, Size>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => a[key]?.width === b[key]?.width && a[key]?.height === b[key]?.height);
}
