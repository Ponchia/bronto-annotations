/**
 * Private, paint-only scheduler for high-frequency pointer previews.
 *
 * Host edits and the authoritative layout remain synchronous and external.
 * A scheduler generation invalidates late/uncancellable animation callbacks
 * after pointer release, host geometry changes or unmount.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ResolvedAnnotation, ResolvedLayout } from '../core/model.js';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type SetPreview = Dispatch<SetStateAction<ResolvedAnnotation | null>>;

export function useAnnotationPreviewScheduler() {
  // This is a projection of a single note only, never a layout commit.
  const [activePreview, setActivePreview] = useState<ResolvedAnnotation | null>(null);
  // Keep the newest pointer movement per requestAnimationFrame without dropping
  // any synchronous onEdit callbacks in the owning React component.
  const pendingPreview = useRef<(() => ResolvedAnnotation) | null>(null);
  const previewFrame = useRef<number | null>(null);
  const previewGeneration = useRef(0);

  const cancelQueuedPreview = useCallback(() => {
    previewGeneration.current += 1;
    if (previewFrame.current !== null) {
      globalThis.cancelAnimationFrame?.(previewFrame.current);
      previewFrame.current = null;
    }
    pendingPreview.current = null;
  }, []);

  const schedulePreview = useCallback((build: () => ResolvedAnnotation) => {
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      // Preserve synchronous behavior in nonvisual/SSR-like test environments.
      setActivePreview(build());
      return;
    }
    pendingPreview.current = build;
    if (previewFrame.current !== null) return;
    const generation = previewGeneration.current;
    previewFrame.current = globalThis.requestAnimationFrame(() => {
      if (previewGeneration.current !== generation) return;
      previewFrame.current = null;
      const latest = pendingPreview.current;
      pendingPreview.current = null;
      if (latest) setActivePreview(latest());
    });
  }, []);

  return { activePreview, setActivePreview, cancelQueuedPreview, schedulePreview };
}

/**
 * Leave this effect at its original orchestration point: it deliberately
 * invalidates previous projections after authoritative host layout changes.
 * Cleanup always clears pending frames, even when cancelAnimationFrame cannot
 * stop an already-queued browser callback.
 */
export function usePreviewLayoutInvalidation({
  layout, previewEdits, setActivePreview, cancelQueuedPreview
}: {
  layout: ResolvedLayout;
  previewEdits: boolean;
  setActivePreview: SetPreview;
  cancelQueuedPreview: () => void;
}) {
  useIsomorphicLayoutEffect(() => {
    setActivePreview(null);
    return cancelQueuedPreview;
  }, [cancelQueuedPreview, layout, previewEdits, setActivePreview]);
}
