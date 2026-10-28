import type { Box } from './model.js';

/** Private broad phase: candidate scoring retains its original narrow phase,
 * obstacle order and full routing input. Built once per solve, never cached by
 * caller array identity: obstacle arrays can change between solves. */
export type ObstacleQuery = (bounds: Box) => readonly Box[];
type Entry = { box: Box; index: number; left: number; top: number; right: number; bottom: number };
type Branch = {
  left: number; top: number; right: number; bottom: number;
  children?: [Branch, Branch];
  entries?: Entry[];
};

export function createObstacleQuery(boxes: Box[]): ObstacleQuery {
  // A small scene is cheaper to scan. Nonfinite endpoints and signed boxes
  // retain the existing scorer's behavior rather than inventing new geometry.
  if (boxes.length < 64 || !boxes.every(indexable)) return () => boxes;
  const root = build(boxes.map((box, index) => ({
    box, index, left: box.x, top: box.y,
    right: box.x + box.width, bottom: box.y + box.height
  })));
  return (bounds) => {
    if (!indexable(bounds)) return boxes;
    const found: Entry[] = [];
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const visit = (branch: Branch) => {
      // Inclusive contact is intentional: connector/rectangle boundary contact
      // is a hit even though the note overlap area at that boundary is zero.
      if (right < branch.left || bounds.x > branch.right
        || bottom < branch.top || bounds.y > branch.bottom) return;
      if (branch.children) {
        visit(branch.children[0]);
        visit(branch.children[1]);
      } else {
        for (const entry of branch.entries!) {
          if (right >= entry.left && bounds.x <= entry.right
            && bottom >= entry.top && bounds.y <= entry.bottom) found.push(entry);
        }
      }
    };
    visit(root);
    // Nonnegative floating-point contributions must be summed in precisely the
    // same order as the linear scan, including duplicate obstacle objects.
    found.sort((a, b) => a.index - b.index);
    return found.map((entry) => entry.box);
  };
}

function indexable(box: Box): boolean {
  return box.width >= 0 && box.height >= 0
    && [box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height].every(Number.isFinite);
}

function build(entries: Entry[]): Branch {
  const branch: Branch = {
    left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity
  };
  for (const entry of entries) {
    branch.left = Math.min(branch.left, entry.left);
    branch.top = Math.min(branch.top, entry.top);
    branch.right = Math.max(branch.right, entry.right);
    branch.bottom = Math.max(branch.bottom, entry.bottom);
  }
  if (entries.length <= 8) return { ...branch, entries };
  const horizontal = branch.right - branch.left >= branch.bottom - branch.top;
  entries.sort((a, b) => horizontal
    ? a.left - b.left || a.index - b.index
    : a.top - b.top || a.index - b.index);
  const middle = Math.floor(entries.length / 2);
  return { ...branch, children: [build(entries.slice(0, middle)), build(entries.slice(middle))] };
}
