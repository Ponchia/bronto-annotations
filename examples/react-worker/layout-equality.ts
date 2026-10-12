/**
 * Host-owned, conservative Worker result reuse. Not a package export.
 *
 * postMessage creates a new object graph. Comparing JSON text loses missing
 * keys, alias identity and accessor safety, so it must never decide whether a
 * previous React annotation can be retained.
 */
import type { ResolvedAnnotation, ResolvedLayout } from '@ponchia/annotations';

export function canReuseWorkerAnnotation(first: unknown, second: unknown): boolean {
  const seenA = new WeakMap<object, object>();
  const seenB = new WeakMap<object, object>();

  function same(a: unknown, b: unknown, parentsA: Set<object>, parentsB: Set<object>): boolean {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return Object.is(a, b);
    }
    if (parentsA.has(a) || parentsB.has(b)) return false;
    // Map aliases bijectively across the *whole* annotation object graph.
    if (seenA.has(a) || seenB.has(b)) return seenA.get(a) === b && seenB.get(b) === a;
    const arrays = Array.isArray(a) && Array.isArray(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (arrays && (a as unknown[]).length !== (b as unknown[]).length) return false;
    if (!arrays && (Object.getPrototypeOf(a) !== Object.prototype
      || Object.getPrototypeOf(b) !== Object.prototype)) return false;
    if (Object.getOwnPropertySymbols(a).length || Object.getOwnPropertySymbols(b).length) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    seenA.set(a, b);
    seenB.set(b, a);
    parentsA.add(a);
    parentsB.add(b);
    try {
      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        const left = Object.getOwnPropertyDescriptor(a, key);
        const right = Object.getOwnPropertyDescriptor(b, key);
        if (!left || !right || !('value' in left) || !('value' in right)) return false;
        if (!same(left.value, right.value, parentsA, parentsB)) return false;
      }
      return true;
    } finally {
      parentsA.delete(a);
      parentsB.delete(b);
    }
  }
  try {
    return same(first, second, new Set(), new Set());
  } catch {
    return false;
  }
}

type CrossNoteGraph = { signature: string; involved: Set<number> };

/**
 * A comparison per annotation cannot see aliases that span *two* annotations.
 * Inspect the relatively small host-authored annotation inputs rather than
 * recursively visiting every generated placement candidate. The normal core
 * resolver allocates each note's resolved geometry separately; host input is
 * the source of possible cross-note sharing.
 *
 * Unknown prototypes, accessors, symbols and non-enumerable data disable
 * compact reuse. This is deliberately conservative and never invokes getters.
 */
function crossNoteSourceGraph(items: readonly ResolvedAnnotation[]): CrossNoteGraph | undefined {
  const firstOwner = new WeakMap<object, { index: number; path: string }>();
  const involved = new Set<number>();
  const links: Array<[number, string, number, string]> = [];
  try {
    for (let index = 0; index < items.length; index += 1) {
      const inspected = new WeakSet<object>();
      const pending: Array<{ value: unknown; path: string }> = [
        { value: items[index]!.annotation, path: '$' }
      ];
      while (pending.length) {
        const { value, path } = pending.pop()!;
        if (value === null || typeof value !== 'object' || inspected.has(value)) continue;
        inspected.add(value);
        const array = Array.isArray(value);
        const prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype
          : prototype !== Object.prototype && prototype !== null) return undefined;
        const first = firstOwner.get(value);
        if (first && first.index !== index) {
          links.push([index, path, first.index, first.path]);
          involved.add(index);
          involved.add(first.index);
        } else if (!first) {
          firstOwner.set(value, { index, path });
        }
        const ownKeys = Reflect.ownKeys(value);
        if (ownKeys.some((key) => typeof key !== 'string')) return undefined;
        const keys = ownKeys as string[];
        keys.sort();
        for (let keyIndex = keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
          const key = keys[keyIndex]!;
          if (array && key === 'length') continue;
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return undefined;
          // Functions cannot be structured-cloned into a Worker response.
          if (typeof descriptor.value === 'function') return undefined;
          pending.push({ value: descriptor.value, path: `${path}/${JSON.stringify(key)}` });
        }
      }
    }
    return { signature: JSON.stringify(links), involved };
  } catch {
    return undefined;
  }
}

/**
 * Even unchanged sharing topology is unsafe for a *partial* patch when one of
 * the changed notes belongs to a cross-note alias group: reusing its sibling
 * would detach the new shared reference. Fall back to the complete snapshot.
 */
export function canReuseWorkerCrossNoteGraph(
  previous: readonly ResolvedAnnotation[],
  next: readonly ResolvedAnnotation[],
  changedIndices: readonly number[]
): boolean {
  if (previous.length !== next.length) return false;
  if (previous.some((item, index) => item.id !== next[index]?.id)) return false;
  const before = crossNoteSourceGraph(previous);
  const after = crossNoteSourceGraph(next);
  if (!before || !after || before.signature !== after.signature) return false;
  return changedIndices.every((index) => !before.involved.has(index) && !after.involved.has(index));
}

/** Share resolved identities only with complete, alias-safe evidence. */
export function shareUnchangedWorkerLayout(before: ResolvedLayout, after: ResolvedLayout): {
  layout: ResolvedLayout;
  reused: number;
} {
  if (before.annotations.length !== after.annotations.length
    || before.annotations.some((item, i) => item.id !== after.annotations[i]?.id)) {
    return { layout: after, reused: 0 };
  }
  const identical = after.annotations.map((item, i) =>
    canReuseWorkerAnnotation(before.annotations[i], item));
  const changed = identical.flatMap((same, i) => same ? [] : [i]);
  if (!canReuseWorkerCrossNoteGraph(before.annotations, after.annotations, changed)) {
    return { layout: after, reused: 0 };
  }
  return {
    layout: { ...after, annotations: after.annotations.map((item, i) =>
      identical[i] ? before.annotations[i]! : item) },
    reused: identical.length - changed.length
  };
}
