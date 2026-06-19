# API Reference

This reference lists the public package subpaths and the primary exports a
consumer should reach for first. See `README.md` for narrative examples,
`docs/context-quickstart.md` for choosing a host context, and
`docs/integration-recipes.md` for longer recipes.

## `@ponchia/annotations`

The root import is DOM-free and has no required React, Vega, Mermaid, D2,
React Flow, or `@ponchia/ui` dependency.

```ts
import {
  annotationClassName,
  annotationFromD3Style,
  applyAnnotationEdits,
  assertAnchorAlignmentReport,
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReport,
  assertAnchorValidationReportIfRequested,
  assertAnnotationLayoutQuality,
  evaluateAnchorAlignment,
  evaluateAnnotationLayout,
  formatAnchorAlignmentReport,
  formatLayoutQualityReport,
  generatedSurfaceLayoutDefaults,
  pointCallout,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  resolvePreparedAnnotationLayout,
  type AnchorAlignmentTarget,
  type Annotation,
  type AnnotationVariant,
  type PreparedAnnotationLayoutOptions,
  type PreparedAnnotationLayoutResult
} from '@ponchia/annotations';
```

Primary groups:

- Models: `Point`, `Box`, `Anchor`, `Annotation`, `AnnotationNote`,
  `AnnotationMetadata`, `AnnotationVariant`, `AnnotationTone`,
  `AnnotationMotion`, `PlacementPreference`, `ManualPlacement`,
  `ResolvedLayout`, `ResolvedAnnotation`, `PlacementCandidate`,
  `AnnotationSubjectGeometry`, `AnnotationConnectorOptions`,
  `GeneratedSurfaceLayoutDefaults`, `GeneratedSurfaceLayoutDefaultsOptions`.
- Layout: `resolveAnnotationLayout`, `refineAnnotationLayout`,
  `estimateNoteSize`, `allPlacementCandidates`, `scorePlacementCandidate`,
  `evaluateAnnotationLayout`, `assertAnnotationLayoutQuality`,
  `formatLayoutQualityReport`, `formatLayoutQualityIssue`,
  `resolvePreparedAnnotationLayout`, `generatedSurfaceLayoutDefaults`,
  `PreparedAnnotationLayoutOptions`, `PreparedAnnotationLayoutResult`.
  `resolvePreparedAnnotationLayout` can also take
  `targetAlignmentTargets`, `targetAlignmentOptions`,
  `targetAlignmentFormat`, and `assertTargetAlignment` so generated chart and
  diagram integrations prove the prepared anchor still matches the generated
  mark, node, handle, edge, or route in the same call as validation and layout
  quality.
- Geometry: `anchorPoint`, `anchorSubject`, `boxCenter`, `boxFromPoints`,
  `boxUnion`, `expandBox`, `insetBox`, `overlapArea`, `resolvePadding`.
- Connectors: `connectorPath`, `connectorPathD`, `nearestPointOnBox`,
  `polylinePathD`.
- SVG helpers: `annotationParts`, `annotationTransform`, `notePlacement`,
  `noteTransform`, `circleSubjectPath`, `rectSubjectPath`, `thresholdPath`,
  `axisThresholdPath`, `bracketSubjectPath`, `bandSubjectPath`,
  `slopeSubjectPath`, `comparisonBracePath`, `outlierClusterPath`,
  `encircleSubjectPath`, `timelineEventPath`, `evidenceMarkerPath`,
  `connectorLine`, `connectorElbow`, `connectorCurve`, `connectorEndDot`,
  `connectorEndArrow`, `declutterLabels`, `directLabels`, `subjectPath`.
- Rendering: `renderAnnotationsSvg`, `renderAnnotationSubjectsSvg`,
  `SvgRenderOptions`. `SvgRenderOptions.noteTabIndex` makes visible SVG notes
  keyboard-focusable for host-provided note navigation, and
  `editHandleTabIndex` can do the same for static SVG edit handles when the
  host wires authoring behavior.
- Edit helpers: `annotationEditHandles`, `annotationEditPatch`,
  `createAnnotationEditEvent`, `createAnnotationEditDelta`,
  `applyAnnotationEdit`, `applyAnnotationEdits`, `translateAnchor`.
- Adapter diagnostics: `formatAnchorValidationReport`,
  `assertAnchorValidationReport`, `assertAnchorValidationReportIfRequested`,
  `formatAnchorDiagnostic`, `evaluateAnchorAlignment`,
  `formatAnchorAlignmentReport`, `assertAnchorAlignmentReport`,
  `assertAnchorAlignmentReportIfRequested`,
  `formatAnchorAlignmentDiagnostic`, `AnchorSpecValidationReport`,
  `AnchorValidationAssertInput`, `AnchorAlignmentTarget`,
  `AnchorAlignmentReport`, `AnchorAlignmentOptions`,
  `AnchorAlignmentAssertInput`.
- Styling helpers: `annotationClassName`, `brontoAnnotationClassName`,
  `annotationStyleVariables`.
- Presets: `pointCallout`, `regionCallout`, `pathCallout`,
  `encircleCallout`, `thresholdAnnotation`, `badgeAnnotation`.
- d3-style bridge: `annotationFromD3Style`, `annotationsFromD3Style`,
  `prepareD3StyleAnnotationCollection`, `annotationsFromD3StyleCollection`,
  `createD3StyleAnnotationBuilder`, `defineD3StyleAnnotationType`,
  `annotationsFromD3StyleType`, `d3StyleAnnotationCollectionEditPatch`,
  `applyD3StyleAnnotationCollectionEdit`, `d3StyleAnnotationEditPatch`,
  `applyD3StyleAnnotationEdit`,
  `D3StyleAnnotationInput`, `D3StyleAnnotationOptions`,
  `D3StyleAnnotationCollectionInput`, `D3StyleAnnotationBuilder`,
  `D3StyleCustomAnnotationDefinition`, `D3StyleAnnotationEditPatch`.
  `D3StyleAnnotationInput.data` is the accessor datum; use
  `annotationData` when migrated d3-style annotations need rendered
  annotation-layer `data-*` attributes.

Boundary: the root package does not render charts, parse diagram languages,
mutate D3 selections, own app state, persist annotations, or provide a design
system.

## `@ponchia/annotations/react`

Use the React subpath for SVG/HTML overlays that should measure notes, render
custom React note content, and emit edit suggestions.

```tsx
import {
  AnnotationLayer,
  useAnnotations,
  type AnnotationLayerEditEvent,
  type AnnotationLayerProps,
  type AnnotationLayerQualityEvent,
  type AnnotationLayerTargetAlignmentEvent
} from '@ponchia/annotations/react';
```

Exports:

- `AnnotationLayer`
- `useAnnotations`
- `AnnotationLayerProps`
- `AnnotationLayerEditOptions`
- `AnnotationLayerEditEvent`
- `AnnotationLayerQualityEvent`
- `AnnotationLayerTargetAlignmentEvent`
- `UseAnnotationsOptions`

`AnnotationLayerProps.noteTabIndex` makes visible notes keyboard-focusable in
the rendered React layer while keeping navigation state in the host app.
`editHandleTabIndex` does the same for React edit handles; it defaults to `0`
for editable layers and can be set to `-1` when the host wants programmatic
focus only.
`assertQuality`, `qualityFormat`, and `onQuality` use the same layout-quality
reporting path as the DOM-free core after each resolved React layout.
`targetAlignmentTargets`, `targetAlignmentOptions`, `targetAlignmentFormat`,
`assertTargetAlignment`, and `onTargetAlignment` use the same generated-target
alignment diagnostics as prepared layouts, which is useful when React renders an
annotation layer over generated chart, diagram, or graph geometry.

Boundary: the React adapter is a renderer/measurement adapter. Host apps still
own annotation state, persistence, routing, and workflow actions.

## `@ponchia/annotations/dom`

Use the DOM subpath when a host surface already rendered elements or SVG marks
and you need anchors or obstacles from measured geometry.

```ts
import {
  anchorFromSelector,
  annotationFrameFromSvg,
  boxFromSvgElement,
  extractedAnchorFromElement,
  prepareDomAnnotations,
  validateDomAnchors,
  type DomAnnotationSpec
} from '@ponchia/annotations/dom';
```

Exports:

- Types: `AnchorKind`, `ElementAnchorOptions`, `SelectorAnchorSpec`,
  `SelectorObstacleSpec`, `DomAnnotationSpec`, `DomAnchorValidationReport`,
  `DomAnnotationLayerInput`, `DomAnnotationLayerOptions`, `ExtractedAnchor`,
  `RectLike`.
- DOMRect and element helpers: `boxFromDOMRect`, `anchorFromDOMRect`,
  `boxFromElement`, `anchorFromElement`, `extractedAnchorFromElement`,
  `anchorFromBox`.
- Selector helpers: `anchorFromSelector`, `anchorFromId`,
  `anchorsFromSelectors`, `annotationsFromDomSelectors`,
  `validateDomAnchors`, `prepareDomAnnotations`.
- Obstacles: `obstaclesFromElements`, `obstaclesFromSelector`,
  `obstaclesFromSelectors`.
- SVG conversion: `svgPointFromClient`, `clientBoxToSvgBox`,
  `boxFromSvgElement`, `annotationFrameFromSvg`.
- Diagnostics: `formatAnchorValidationReport`,
  `assertAnchorValidationReport`, `evaluateAnchorAlignment`,
  `formatAnchorAlignmentReport`, `assertAnchorAlignmentReport`.
  `prepareDomAnnotations` accepts `assert: true` or
  `assert: { label, failOnWarnings }`.

Boundary: this subpath measures existing rendered geometry. It does not render
the host surface or own application state.

## `@ponchia/annotations/vega`

Use the Vega subpath after a Vega View has data/scales/scenegraph output, or
after the host has rendered/exported Vega SVG. Vega-Lite consumers compile or
render through public Vega-Lite/Vega APIs first, then use this adapter against
the resulting Vega View or SVG.

```ts
import {
  prepareVegaScenegraphAnnotations,
  prepareVegaSvgAnnotations,
  validateVegaScenegraphAnchors,
  type VegaScenegraphAnchorSpec
} from '@ponchia/annotations/vega';
```

Exports:

- View data: `anchorsFromVegaView`, `annotationsFromVegaView`,
  `prepareVegaViewAnnotations`, `validateVegaViewAnchors`,
  `obstaclesFromVegaView`, `anchorFromVegaDatum`,
  `VegaViewAnchorSpec`, `VegaViewObstacleOptions`, `VegaViewLike`.
- Scales: `anchorsFromVegaScales`, `annotationsFromVegaScales`,
  `prepareVegaScaleAnnotations`, `obstaclesFromVegaScales`,
  `validateVegaScaleAnchors`, `VegaScaleAnchorSpec`,
  `VegaScaleObstacleOptions`, `VegaScaleViewLike`, `VegaScaleFunction`.
- Scenegraph: `anchorsFromVegaScenegraph`,
  `annotationsFromVegaScenegraph`, `prepareVegaScenegraphAnnotations`,
  `obstaclesFromVegaScenegraph`, `validateVegaScenegraphAnchors`,
  `VegaScenegraphAnchorSpec`, `VegaScenegraphObstacleOptions`,
  `VegaScenegraphItem`, `VegaScenegraphViewLike`.
- Rendered SVG: `anchorsFromVegaSvg`, `annotationsFromVegaSvg`,
  `prepareVegaSvgAnnotations`, `obstaclesFromVegaSvg`,
  `validateVegaSvgAnchors`, `findVegaSvgElement`, `VegaSvgAnchorSpec`,
  `VegaSvgAnnotationSpec`, `VegaSvgObstacleOptions`.
- Shared: `VegaAnnotationAuthoring`, `VegaAnchorResult`,
  `VegaAnchorValidationReport`, `VegaAnnotationLayerInput`,
  `formatAnchorValidationReport`, `assertAnchorValidationReport`,
  `evaluateAnchorAlignment`, `formatAnchorAlignmentReport`,
  `assertAnchorAlignmentReport`. Every `prepareVega*Annotations` helper accepts
  `assert: true` or `assert: { label, failOnWarnings }`.

Rendered SVG metadata matching identifies the Vega wrapper/layer. If that
wrapper contains exactly one concrete mark element, anchors measure that child
mark; multi-mark layers should use a selector or scenegraph datum predicate.

Boundary: the adapter does not create Vega specs, own scales, infer chart
semantics, or require a `vega-lite` peer.

## `@ponchia/annotations/mermaid`

Use the Mermaid subpath after Mermaid has rendered SVG.

```ts
import {
  prepareMermaidAnnotations,
  validateMermaidSvgAnchors,
  type MermaidAnchorSpec
} from '@ponchia/annotations/mermaid';
```

Exports:

- Anchor extraction: `anchorsFromMermaidSvg`, `annotationsFromMermaidSvg`,
  `prepareMermaidAnnotations`, `validateMermaidSvgAnchors`,
  `findMermaidElement`, `findElementByText`.
- Obstacles: `obstaclesFromMermaidSvg`.
- Types: `MermaidAnchorSpec`, `MermaidObstacleOptions`,
  `MermaidAnnotationLayerOptions`, `MermaidAnchorResult`,
  `MermaidAnnotationAuthoring`, `MermaidAnchorDiagnostic`,
  `MermaidAnchorValidationReport`, `MermaidAnnotationLayerInput`,
  `MermaidLabelMatch`.
- Diagnostics: `formatAnchorValidationReport`,
  `assertAnchorValidationReport`, `evaluateAnchorAlignment`,
  `formatAnchorAlignmentReport`, `assertAnchorAlignmentReport`.
  `prepareMermaidAnnotations` accepts `assert: true` or
  `assert: { label, failOnWarnings }`.

Boundary: the adapter targets rendered Mermaid SVG ids, labels, nodes, edges,
clusters, classes, data attributes, and selectors. It does not parse Mermaid
source or own diagram layout.

For rendered edge annotations, use `edgeId` when the generated edge id is known,
or `edgeSourceId` plus `edgeTargetId` when the host knows the connected node ids.
Requested edge path anchors still prefer the child route `<path>` over the
wrapper edge group.

## `@ponchia/annotations/d2`

Use the D2 subpath with compiled D2 diagram geometry, or rendered D2 SVG when
only the SVG is available.

```ts
import {
  prepareD2DiagramAnnotations,
  prepareD2SvgAnnotations,
  validateD2DiagramAnchors,
  type D2DiagramAnchorSpec
} from '@ponchia/annotations/d2';
```

Exports:

- Compiled diagram: `anchorsFromD2Diagram`, `annotationsFromD2Diagram`,
  `prepareD2DiagramAnnotations`, `validateD2DiagramAnchors`,
  `obstaclesFromD2Diagram`, `allD2Shapes`, `allD2Connections`,
  `D2DiagramAnchorSpec`, `D2DiagramLike`, `D2ShapeLike`,
  `D2ConnectionLike`, `D2ObstacleOptions`,
  `D2DiagramAnnotationLayerOptions`.
- Rendered SVG: `anchorsFromD2Svg`, `annotationsFromD2Svg`,
  `prepareD2SvgAnnotations`, `validateD2SvgAnchors`,
  `obstaclesFromD2Svg`, `findD2SvgElement`, `D2SvgAnchorSpec`,
  `D2SvgObstacleOptions`, `D2SvgAnnotationLayerOptions`.
- Shared: `D2AnnotationAuthoring`, `D2AnchorResult`,
  `D2LabelMatch`, `D2AnchorDiagnostic`, `D2AnchorValidationReport`,
  `D2AnnotationLayerInput`, `formatAnchorValidationReport`,
  `assertAnchorValidationReport`, `evaluateAnchorAlignment`,
  `formatAnchorAlignmentReport`, `assertAnchorAlignmentReport`.
  `prepareD2DiagramAnnotations` and `prepareD2SvgAnnotations` accept
  `assert: true` or `assert: { label, failOnWarnings }`.

Boundary: the adapter does not parse D2 source or execute D2. Hosts provide
compiled diagram geometry or rendered SVG. Exact and contains label matching are
supported for compiled diagram labels and rendered SVG text. When a rendered SVG
connection spec asks for `kind: 'path'`, the adapter prefers a child route
`<path>` over the wrapper group.

## `@ponchia/annotations/react-flow`

Use the React Flow subpath with public node, handle, edge, and viewport state.

```ts
import {
  prepareReactFlowAnnotations,
  validateReactFlowAnchors,
  type ReactFlowAnchorSpec
} from '@ponchia/annotations/react-flow';
```

Exports:

- Extraction: `anchorsFromReactFlow`, `annotationsFromReactFlow`,
  `prepareReactFlowAnnotations`, `validateReactFlowAnchors`,
  `obstaclesFromReactFlow`. Obstacles can include nodes, measured handles via
  `includeHandles`, and edges.
- Geometry: `nodeBox`, `handleBox`, `handlePoint`.
- Types: `ReactFlowAnchorSpec`, `ReactFlowAnchorInput`,
  `ReactFlowAnnotationAuthoring`, `ReactFlowViewportLike`,
  `ReactFlowHandleType`, `ReactFlowHandleLike`,
  `ReactFlowHandleBoundsLike`, `ReactFlowNodeLike`, `ReactFlowEdgeLike`,
  `ReactFlowHandleAnchorSpec`, `ReactFlowObstacleOptions`,
  `ReactFlowAnnotationLayerOptions`, `ReactFlowAnchorResult`,
  `ReactFlowAnchorDiagnostic`, `ReactFlowAnchorValidationReport`,
  `ReactFlowAnnotationLayerInput`.
- Diagnostics: `formatAnchorValidationReport`,
  `assertAnchorValidationReport`, `evaluateAnchorAlignment`,
  `formatAnchorAlignmentReport`, `assertAnchorAlignmentReport`.
  `prepareReactFlowAnnotations` accepts `assert: true` or
  `assert: { label, failOnWarnings }`; use `failOnWarnings: true` to reject
  unmeasured handle fallbacks.

Default edge anchors use measured `sourceHandle` and `targetHandle` centers when
available. Supply `edgePoints` in `ReactFlowAnchorInput` when the host wants
annotations to follow a custom routed edge path.

Boundary: the adapter does not own graph layout, React Flow interaction policy,
application state, or persistence.

## `@ponchia/annotations/bronto.css`

Import the CSS bridge when using the built-in SVG/React renderers, package
classes, or migrated Bronto static SVG snippets.

```ts
import '@ponchia/annotations/bronto.css';
```

Styled class families:

- Package classes: `.pa-annotation-layer`, `.pa-annotation`,
  `.pa-annotation__subject`, `.pa-annotation__connector`,
  `.pa-annotation__note`, `.pa-annotation__note-line`,
  `.pa-annotation__title`, `.pa-annotation__label`,
  `.pa-annotation__badge`, `.pa-annotation__edit-handle`.
- Legacy Bronto classes: `.ui-annotation`, `.ui-annotation__subject`,
  `.ui-annotation__connector`, `.ui-annotation__connector-end`,
  `.ui-annotation__note`, `.ui-annotation__note-line`,
  `.ui-annotation__title`, `.ui-annotation__label`,
  `.ui-annotation__badge`.
- Modifiers: variants such as `--callout`, `--circle`, `--threshold`,
  `--badge`, `--bracket`, `--band`, `--slope`, `--compare`, `--cluster`,
  `--axis`, `--timeline`, and `--evidence`; tones such as `--accent`,
  `--muted`, `--success`, `--warning`, `--danger`, and `--info`; motion hints
  such as `--draw`, `--reveal`, `--pulse`, and `--focus`.

Boundary: this subpath is styling only. It does not import `@ponchia/ui` or
provide a design system.
