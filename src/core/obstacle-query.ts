import type { Box } from './model.js';

type Bounds = { left: number; top: number; right: number; bottom: number };
type Entry = Bounds & { index: number };
type Branch = Bounds & { entries?: Entry[]; children?: [Branch, Branch] };

/** Private broad phase for one synchronous solve. Never cache a caller's
 * mutable obstacle array between solves. Results retain source order, including
 * duplicates, so floating-point sums and collision counts remain unchanged. */
export type ObstacleQuery = (box: Box) => readonly Box[];

export function createObstacleQuery(obstacles: readonly Box[]): ObstacleQuery | undefined {
  if (obstacles.length < 32) return undefined;
  const entries: Entry[] = [];
  for (const [index, box] of obstacles.entries()) {
    const bounds = finiteBounds(box);
    // Public low-level scorers accept unusual geometry. Keep their existing
    // behavior rather than silently normalize or discard it in an optimization.
    if (!bounds) return undefined;
    entries.push({ ...bounds, index });
  }
  const tree = branch(entries);
  return (box) => {
    const bounds = finiteBounds(box);
    if (!bounds) return obstacles;
    const hits: number[] = [];
    const visit = (node: Branch): void => {
      if (!touches(node, bounds)) return;
      if (node.entries) {
        for (const entry of node.entries) if (touches(entry, bounds)) hits.push(entry.index);
      } else if (node.children) {
        visit(node.children[0]);
        visit(node.children[1]);
      }
    };
    visit(tree);
    hits.sort((a, b) => a - b);
    return hits.map((index) => obstacles[index]!);
  };
}

function finiteBounds(box: Box): Bounds | undefined {
  const right = box.x + box.width, bottom = box.y + box.height;
  if (box.width < 0 || box.height < 0
    || ![box.x, box.y, box.width, box.height, right, bottom].every(Number.isFinite)) return;
  return { left: box.x, top: box.y, right, bottom };
}

function touches(a: Bounds, b: Bounds): boolean {
  // Boundary contact matters for connectors, even though its overlap area is zero.
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function branch(entries: Entry[]): Branch {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const entry of entries) {
    left = Math.min(left, entry.left); top = Math.min(top, entry.top);
    right = Math.max(right, entry.right); bottom = Math.max(bottom, entry.bottom);
  }
  const bounds = { left, top, right, bottom };
  if (entries.length <= 8) return { ...bounds, entries };
  const axis = right - left >= bottom - top ? 'left' : 'top';
  entries.sort((a, b) => a[axis] - b[axis] || a.index - b.index);
  const middle = Math.floor(entries.length / 2);
  return { ...bounds, children: [branch(entries.slice(0, middle)), branch(entries.slice(middle))] };
}
