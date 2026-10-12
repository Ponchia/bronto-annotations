/**
 * Private touch-scrolling boundary for interactive SVG edit handles.
 *
 * touch-action:none on the editing circles is the normal Pointer Events
 * contract. Some mobile engines still negotiate native scrolling when the
 * value belongs to an inner SVG element. A non-passive touchstart handler on
 * the SVG root conservatively prevents *only* touches beginning on an edit
 * handle group, leaving the host diagram and note content scrollable.
 *
 * Do not attach a touchmove listener: scrolling is decided when the gesture
 * starts, and native scrolling elsewhere must remain browser-owned.
 */
import { useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined'
  ? useEffect : useLayoutEffect;

export function useEditableSvgTouchBoundary(
  svgRef: RefObject<SVGSVGElement | null>, enabled: boolean
) {
  useIsomorphicLayoutEffect(() => {
    const root = svgRef.current;
    if (!root || !enabled) return undefined;

    const handleTouchStart = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !root.contains(target)) return;
      // Both the 9px visual handle and its enlarged hit circle belong to this
      // g[data-edit-handle] group, regardless of caller-selected classPrefix.
      // Do not prevent touches on ordinary notes, base SVG, or stage chrome.
      const group = target.closest('g[data-edit-handle][data-annotation-id]');
      if (event.cancelable && group && root.contains(group)) event.preventDefault();
    };

    root.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => root.removeEventListener('touchstart', handleTouchStart);
  }, [svgRef, enabled]);
}
