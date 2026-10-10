/**
 * Host-side candidate recipe for annotated React Flow handles in dense graphs.
 * Handle centers can lie inside the owning card cluster. A 20px callout offset
 * often creates an overlap, even if the anchor lookup was perfectly accurate.
 * Try distances informed by the actual rendered owner's height and let normal
 * placement scoring choose the best viable side and position.
 */
export function handleClearanceOffsets(handle, nodes) {
  const owner = nodes.find((node) => node.id === handle.nodeId);
  const height = owner?.box.height ?? 160;
  return [18, 28, Math.round(height * 0.55 + 12), Math.round(height + 26)];
}
