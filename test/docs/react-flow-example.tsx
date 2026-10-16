import { AnnotationLayer } from '@ponchia/annotations/react';
import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';
import { useNodes, useViewport } from '@xyflow/react';
import '@ponchia/annotations/bronto.css';

export function FlowNotes({ width, height }: {
  width: number;
  height: number;
}) {
  const nodes = useNodes();
  const viewport = useViewport();
  const review = nodes.find((node) => node.id === 'review');
  if (!(review?.measured?.width && review.measured.height)) return null;

  const prepared = prepareReactFlowAnnotations({ nodes, viewport }, [{
    id: 'review-note',
    nodeId: 'review',
    note: { title: 'Review this step' }
  }], { assert: { label: 'Flow targets' } });

  return (
    <AnnotationLayer
      annotations={prepared.annotations}
      obstacles={prepared.obstacles}
      bounds={{ x: 0, y: 0, width, height }}
      label="Graph annotations"
      markerIdPrefix="flow-notes"
    />
  );
}
