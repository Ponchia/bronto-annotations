export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Box = Point & Size;

export type PlacementSide = 'top' | 'right' | 'bottom' | 'left';

export type PlacementAlign = 'start' | 'center' | 'end';

export type AnnotationNoteAlign = 'start' | 'center' | 'end';

export type DataAttributes = Record<string, string | number | boolean | null | undefined>;

export type AnnotationMetadata = Record<string, unknown>;

export type ManualPlacement = Point & {
  side?: PlacementSide;
  align?: PlacementAlign;
  clamp?: boolean;
};

export type AnnotationVariant =
  | 'label'
  | 'callout'
  | 'elbow'
  | 'curve'
  | 'circle'
  | 'rect'
  | 'threshold'
  | 'badge'
  | 'bracket'
  | 'band'
  | 'slope'
  | 'compare'
  | 'cluster'
  | 'axis'
  | 'timeline'
  | 'evidence';

export type AnnotationTone = 'accent' | 'muted' | 'success' | 'warning' | 'danger' | 'info';

export type AnnotationMotion = 'draw' | 'reveal' | 'pulse' | 'focus';

export type AnnotationStyleVariableName = `--${string}`;

export type AnnotationStyle = {
  color?: string;
  lineColor?: string;
  noteBackground?: string;
  subjectFill?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  strokeWidth?: string | number;
  vars?: Partial<Record<AnnotationStyleVariableName, string | number | null | undefined>>;
};

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PaddingInput = number | Partial<Padding>;

export type Anchor =
  | { type: 'point'; point: Point }
  | { type: 'box'; box: Box; side?: PlacementSide }
  | { type: 'path'; points: Point[] };

export type SubjectShape = 'auto' | 'none' | 'point' | 'circle' | 'rect' | 'path';

export type AnnotationSubjectGeometry =
  | { type: 'circle'; radius: number; radiusPadding?: number }
  | { type: 'rect'; width: number; height: number; x?: number; y?: number; padding?: number }
  | { type: 'threshold'; x1?: number; y1?: number; x2: number; y2: number }
  | { type: 'bracket'; x1: number; y1: number; x2: number; y2: number; depth?: number }
  | { type: 'band'; x?: number; y?: number; width: number; height: number; padding?: number }
  | { type: 'slope'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'compare'; x1: number; y1: number; x2: number; y2: number; depth?: number }
  | { type: 'cluster'; points: Point[]; radius?: number }
  | { type: 'encircle'; points: Point[]; radius?: number; padding?: number }
  | { type: 'axis'; orientation?: 'horizontal' | 'vertical'; value?: number; start?: number; end: number }
  | { type: 'timeline'; size?: number; direction?: 'up' | 'down' | 'left' | 'right' }
  | { type: 'evidence'; x?: number; y?: number; width?: number; height?: number; padding?: number };

export type AnnotationSubjectGeometrySpace = 'anchor' | 'absolute';

export type AnnotationSubjectOptions = {
  shape?: SubjectShape;
  path?: string;
  geometry?: AnnotationSubjectGeometry;
  geometrySpace?: AnnotationSubjectGeometrySpace;
  badge?: boolean | AnnotationBadgeOptions;
  radius?: number;
  padding?: PaddingInput;
  cornerRadius?: number;
  className?: string;
  data?: DataAttributes;
};

export type AnnotationBadgeOptions = {
  label?: string;
  radius?: number;
  x?: 'left' | 'center' | 'right';
  y?: 'top' | 'center' | 'bottom';
  className?: string;
  data?: DataAttributes;
};

export type ConnectorType = 'elbow' | 'straight' | 'curve' | 'none';

export type ConnectorEnd = 'none' | 'arrow' | 'dot';

export type ConnectorPointMode = 'absolute' | 'relative';

export type ConnectorRoutingMode = 'none' | 'orthogonal';

export type ConnectorRoutingPreference = 'shortest' | 'horizontal' | 'vertical';

export type ConnectorRoutingOptions = {
  mode?: ConnectorRoutingMode;
  padding?: number;
  maxObstacles?: number;
  preference?: ConnectorRoutingPreference;
};

export type AnnotationConnectorOptions = {
  type?: ConnectorType;
  end?: ConnectorEnd;
  points?: Point[];
  pointMode?: ConnectorPointMode;
  routing?: ConnectorRoutingMode | ConnectorRoutingOptions;
  startOffset?: number;
  endOffset?: number;
  className?: string;
  data?: DataAttributes;
};

export type AnnotationNote = {
  title?: string;
  body?: string;
  ariaLabel?: string;
  align?: AnnotationNoteAlign;
  line?: boolean | AnnotationNoteLineOptions;
  visible?: boolean;
  wrap?: number;
  wrapSplitter?: string | RegExp;
  maxLines?: number;
  padding?: PaddingInput;
  className?: string;
  data?: DataAttributes;
  metadata?: AnnotationMetadata;
};

export type AnnotationNoteLineOptions = {
  visible?: boolean;
  orientation?: 'horizontal' | 'vertical';
  length?: number;
  offset?: number;
  className?: string;
  data?: DataAttributes;
};

export type PlacementPreference = {
  side?: PlacementSide | PlacementSide[];
  allowedSides?: PlacementSide[];
  align?: PlacementAlign | PlacementAlign[];
  allowedAligns?: PlacementAlign[];
  offset?: number | number[];
  crossOffset?: number | number[];
  maxCandidates?: number;
  manual?: ManualPlacement;
};

export type LayoutRefinementOptions = {
  enabled?: boolean;
  passes?: number;
  maxCandidatesPerAnnotation?: number;
};

export type Annotation = {
  id: string;
  anchor: Anchor;
  note: AnnotationNote;
  placement?: PlacementPreference;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
  variant?: AnnotationVariant;
  tone?: AnnotationTone;
  motion?: AnnotationMotion;
  style?: AnnotationStyle;
  priority?: number;
  className?: string;
  data?: DataAttributes;
  metadata?: AnnotationMetadata;
};

export type ResolvedSubject =
  | { type: 'point'; point: Point; box: Box }
  | { type: 'box'; point: Point; box: Box; side?: PlacementSide }
  | { type: 'path'; point: Point; box: Box; points: Point[] };

export type ConnectorPath = {
  type: ConnectorType;
  points: Point[];
  d: string;
};

export type PlacementCandidate = {
  side: PlacementSide;
  align: PlacementAlign;
  offset: number;
  crossOffset: number;
  noteBox: Box;
  rawNoteBox: Box;
  connector: ConnectorPath;
  score: number;
  scoreBreakdown: {
    preferredSide: number;
    overflow: number;
    obstacles: number;
    connectors: number;
    annotations: number;
    distance: number;
    alignment: number;
    crossOffset: number;
    tieBreak: number;
  };
};

export type ResolvedPlacement = {
  side: PlacementSide;
  offset: number;
  align: PlacementAlign;
  score: number;
  manual?: boolean;
  candidates: PlacementCandidate[];
};

export type ResolvedAnnotation = {
  id: string;
  annotation: Annotation;
  subject: ResolvedSubject;
  anchorPoint: Point;
  noteBox: Box;
  connector: ConnectorPath;
  placement: ResolvedPlacement;
};

export type LayoutOptions = {
  annotations: Annotation[];
  bounds: Box;
  padding?: PaddingInput;
  obstacles?: Box[];
  noteSizes?: Record<string, Size>;
  defaultNoteSize?: Size;
  placement?: PlacementPreference;
  refinement?: boolean | LayoutRefinementOptions;
};

export type ResolvedLayout = {
  bounds: Box;
  placementBounds: Box;
  padding: Padding;
  annotations: ResolvedAnnotation[];
  obstacles: Box[];
};

export const DEFAULT_SIDES: PlacementSide[] = ['top', 'right', 'bottom', 'left'];

export const DEFAULT_NOTE_SIZE: Size = {
  width: 168,
  height: 72
};

export const DEFAULT_NOTE_PADDING: Padding = {
  top: 10,
  right: 14,
  bottom: 10,
  left: 14
};

export const DEFAULT_PLACEMENT: { align: PlacementAlign; offset: number } = {
  align: 'center',
  offset: 16
};
