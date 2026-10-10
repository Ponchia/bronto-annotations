export function handleClearanceOffsets(
  handle: { nodeId: string },
  nodes: Array<{ id: string; box: { height: number } }>
): number[];
