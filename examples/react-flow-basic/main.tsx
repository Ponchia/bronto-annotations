import { AnnotationLayer } from '@ponchia/annotations/react';
import {
  annotationEditPatch,
  generatedSurfaceLayoutDefaults,
  type AnnotationEditPatch,
  type AnchorAlignmentReport,
  type AnchorAlignmentTarget
} from '@ponchia/annotations';
import {
  handleBox,
  nodeBox,
  prepareReactFlowAnnotations
} from '@ponchia/annotations/react-flow';
import '@ponchia/annotations/bronto.css';
import {
  Background,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  useEdges,
  useNodes,
  useViewport
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type LayerBounds = {
  box: { x: number; y: number; width: number; height: number };
  measured: boolean;
};

const nodes: Node[] = [
  { id: 'ingest', position: { x: 96, y: 150 }, sourcePosition: Position.Right, width: 142, height: 58, data: { label: 'Ingest' } },
  { id: 'review', position: { x: 312, y: 150 }, sourcePosition: Position.Right, targetPosition: Position.Left, width: 142, height: 58, data: { label: 'Review' } },
  { id: 'publish', position: { x: 528, y: 150 }, targetPosition: Position.Left, width: 142, height: 58, data: { label: 'Publish' } }
];
const edges: Edge[] = [
  { id: 'ingest-review', source: 'ingest', target: 'review' },
  { id: 'review-publish', source: 'review', target: 'publish' }
];
const flowLayoutDefaults = generatedSurfaceLayoutDefaults({
  anchorLabel: 'React Flow anchors',
  failOnWarnings: true,
  includeInfo: true,
  layoutLabel: 'React Flow annotations'
});

function FlowAnnotations({ bounds }: { bounds: LayerBounds }) {
  const flowNodes = useNodes<Node>();
  const flowEdges = useEdges<Edge>();
  const viewport = useViewport();
  const [editPatches, setEditPatches] = useState<Record<string, AnnotationEditPatch>>({});
  const hasMeasuredNodes = flowNodes.some((node) => node.id === 'review'
    && ((node.measured?.width ?? node.width ?? 0) > 0)
    && ((node.measured?.height ?? node.height ?? 0) > 0));
  const adapterNodes = useMemo(() => flowNodes.map((node) => {
    if (node.id !== 'review') {
      return node;
    }

    const width = node.measured?.width ?? node.width ?? 142;
    const height = node.measured?.height ?? node.height ?? 58;

    return {
      ...node,
      handles: [
        ...(node.handles ?? []),
        {
          id: 'review-source',
          nodeId: 'review',
          type: 'source' as const,
          position: 'right' as const,
          x: width,
          y: height / 2 - 4,
          width: 8,
          height: 8
        }
      ]
    };
  }), [flowNodes]);
  const compact = bounds.box.width < 520;
  const targetAlignmentRef = useRef<{
    targetAlignment?: AnchorAlignmentReport;
    targetAlignmentSummary: string;
  }>({ targetAlignmentSummary: '' });
  const baseAnnotationSpecs = useMemo(() => [
    {
      id: 'flow-review',
      nodeId: 'review',
      note: {
        title: 'React Flow node',
        body: 'Uses public measured node state.'
      },
      placement: compact
        ? { manual: { x: 12, y: 54, side: 'bottom' as const } }
        : { side: 'top' as const },
      subject: { shape: 'rect' as const, padding: 4 },
      priority: 2
    },
    {
      id: 'flow-edge',
      edgeId: 'review-publish',
      note: {
        title: 'React Flow edge',
        body: 'Path follows measured node boxes.'
      },
      placement: compact ? {
        manual: { x: 81, y: 288, side: 'top' as const }
      } : {
        side: 'bottom' as const,
        allowedSides: ['bottom' as const, 'top' as const],
        offset: [54, 72],
        crossOffset: [0, -56, 56]
      },
      subject: { shape: 'path' as const }
    },
    {
      id: 'flow-handle',
      handle: { nodeId: 'review', id: 'review-source', type: 'source' as const, side: 'right' as const, center: true },
      note: {
        title: 'React Flow handle',
        body: 'Anchored to a measured public handle.'
      },
      placement: compact ? {
        manual: { x: 182, y: 54, side: 'bottom' as const }
      } : {
        side: 'right' as const,
        allowedSides: ['right' as const, 'top' as const, 'bottom' as const, 'left' as const],
        offset: [18, 32],
        crossOffset: [0, -72, 72]
      },
      subject: { shape: 'point' as const, radius: 6 },
      tone: 'info' as const
    }
  ], [compact]);
  const annotationSpecs = useMemo(() => baseAnnotationSpecs.map((spec) => {
    const patch = editPatches[spec.id];

    return patch?.placement ? { ...spec, placement: patch.placement } : spec;
  }), [baseAnnotationSpecs, editPatches]);
  const prepared = useMemo(() => {
    if (!hasMeasuredNodes) {
      return undefined;
    }

    const nextPrepared = prepareReactFlowAnnotations({
      nodes: adapterNodes,
      edges: flowEdges,
      viewport
    }, annotationSpecs, {
      assert: flowLayoutDefaults.assertValidation,
      obstacles: {
        includeEdges: true,
        padding: 4
      }
    });

    return nextPrepared;
  }, [adapterNodes, annotationSpecs, flowEdges, hasMeasuredNodes, viewport]);
  const targetAlignmentTargets = useMemo<AnchorAlignmentTarget[]>(() => {
    if (!prepared) {
      return [];
    }

    const reviewNode = adapterNodes.find((node) => node.id === 'review');
    const publishNode = adapterNodes.find((node) => node.id === 'publish');
    const reviewBox = reviewNode ? nodeBox(reviewNode, viewport) : undefined;
    const publishBox = publishNode ? nodeBox(publishNode, viewport) : undefined;
    const reviewHandle = reviewNode?.handles?.find((handle) => handle.id === 'review-source');
    const reviewHandleBox = reviewNode && reviewHandle ? handleBox(reviewNode, reviewHandle, viewport) : undefined;
    return [
      {
        id: 'flow-review',
        expected: 'React Flow review node',
        ...(reviewBox ? { box: reviewBox } : {})
      },
      {
        id: 'flow-edge',
        expected: 'React Flow review to publish edge',
        ...(reviewBox && publishBox ? {
          points: [
            { x: reviewBox.x + reviewBox.width, y: reviewBox.y + reviewBox.height / 2 },
            { x: publishBox.x, y: publishBox.y + publishBox.height / 2 }
          ]
        } : {})
      },
      {
        id: 'flow-handle',
        expected: 'React Flow review source handle',
        ...(reviewHandleBox ? { box: reviewHandleBox } : {})
      }
    ];
  }, [adapterNodes, prepared, viewport]);
  const annotations = prepared?.annotations ?? [];
  const obstacles = prepared?.obstacles ?? [];

  if (!bounds.measured) {
    return null;
  }

  return (
    <AnnotationLayer
      annotations={annotations}
      bounds={bounds.box}
      measure="estimate"
      padding={12}
      noteTabIndex={0}
      editable={{ noteHandlePosition: 'bottom-right' }}
      editHandleTabIndex={0}
      obstacles={obstacles}
      refinement={{ passes: 2, maxCandidatesPerAnnotation: 64 }}
      assertQuality={flowLayoutDefaults.assertQuality}
      assertTargetAlignment={targetAlignmentTargets.length > 0
        ? { label: 'React Flow target alignment', failOnWarnings: true }
        : undefined}
      qualityFormat={flowLayoutDefaults.qualityFormat}
      targetAlignmentTargets={targetAlignmentTargets}
      targetAlignmentOptions={{
        tolerance: 8,
        nearTolerance: 12,
        minOverlapRatio: 0.5
      }}
      targetAlignmentFormat={{
        label: 'React Flow target alignment',
        includeAligned: true
      }}
      noteSizes={compact
        ? {
          'flow-review': { width: 148, height: 88 },
          'flow-edge': { width: 180, height: 86 },
          'flow-handle': { width: 148, height: 88 }
        }
        : {
          'flow-review': { width: 230, height: 72 },
          'flow-edge': { width: 230, height: 72 },
          'flow-handle': { width: 220, height: 72 }
        }}
      onTargetAlignment={({ targetAlignment, summary }) => {
        targetAlignmentRef.current = {
          targetAlignment,
          targetAlignmentSummary: summary
        };
      }}
      onEdit={(event) => {
        Object.assign(window, {
          __annotationsLastEdit: {
            annotationId: event.annotationId,
            phase: event.phase,
            manual: event.suggestedPlacement?.manual,
            anchor: event.suggestedAnchor
          }
        });
      }}
      onEditEnd={(event) => {
        if (!event.suggestedPlacement) {
          return;
        }

        setEditPatches((current) => ({
          ...current,
          [event.annotationId]: annotationEditPatch(event)
        }));
      }}
      onQuality={({ layout, quality, summary }) => {
        window.requestAnimationFrame(() => {
          const targetAlignmentEvidence = targetAlignmentRef.current;

          Object.assign(window, {
            __annotationsExample: {
              name: 'react-flow-basic',
              quality,
              qualitySummary: summary,
              targetAlignment: targetAlignmentEvidence.targetAlignment,
              targetAlignmentSummary: targetAlignmentEvidence.targetAlignmentSummary,
              anchorSource: 'react-flow-state',
              renderedNodes: document.querySelectorAll('.react-flow__node').length,
              renderedEdges: document.querySelectorAll('.react-flow__edge').length,
              generatedObstacles: obstacles.length,
              validation: prepared?.validation,
              anchorEvidence: annotations.map((annotation) => annotation.data),
              anchorIds: annotations.map((annotation) => annotation.id),
              annotations: layout.annotations.map((annotation) => ({
                id: annotation.id,
                manual: annotation.annotation.placement?.manual,
                anchor: annotation.annotation.anchor
              })),
              editPatchIds: Object.keys(editPatches),
              viewport,
              viewportTransformActive: Math.abs(viewport.zoom - 1) > 0.01
                || Math.abs(viewport.x) > 0.5
                || Math.abs(viewport.y) > 0.5,
              bounds,
              obstacles
            }
          });
        });
      }}
      style={{ inset: 0, position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8 }}
    />
  );
}

function App() {
  const shellRef = useRef<HTMLElement>(null);
  const bounds = useElementBounds(shellRef);

  return (
    <main className="example-shell">
      <section ref={shellRef} className="flow-shell" aria-label="React Flow annotation example">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <FlowAnnotations bounds={bounds} />
        </ReactFlow>
      </section>
    </main>
  );
}

function useElementBounds(ref: RefObject<HTMLElement | null>): LayerBounds {
  const [bounds, setBounds] = useState<LayerBounds>({
    box: { x: 0, y: 0, width: 0, height: 0 },
    measured: false
  });

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();

      setBounds({
        box: {
          x: 0,
          y: 0,
          width: rect.width,
          height: rect.height
        },
        measured: rect.width > 0 && rect.height > 0
      });
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);

      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return bounds;
}

const root = document.querySelector('#root');

if (root) {
  createRoot(root).render(<App />);
}
