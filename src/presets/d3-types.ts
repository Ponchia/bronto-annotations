import type { AnnotationEditPatch, AnnotationEditSuggestion } from '../core/edit.js';
import type { Annotation, AnnotationNote, AnnotationStyle, AnnotationMotion, AnnotationTone, AnnotationVariant, DataAttributes, PlacementPreference, Point } from '../core/model.js';

export type D3AnnotationDisablePart = 'subject' | 'connector' | 'note';

export type D3AnnotationType =
  | 'label'
  | 'callout'
  | 'callout-elbow'
  | 'callout-curve'
  | 'callout-circle'
  | 'callout-rect'
  | 'xy-threshold'
  | 'badge'
  | 'annotationLabel'
  | 'annotationCallout'
  | 'annotationCalloutElbow'
  | 'annotationCalloutCurve'
  | 'annotationCalloutCircle'
  | 'annotationCalloutRect'
  | 'annotationXYThreshold'
  | 'annotationBadge';

export type D3AnnotationConnectorType = 'line' | 'straight' | 'elbow' | 'curve' | 'none';

export type D3AnnotationOrientation = 'topBottom' | 'leftRight' | 'top' | 'bottom' | 'left' | 'right' | 'fixed';

export type D3AnnotationAlign = AnnotationNote['align'] | 'dynamic' | 'left' | 'right' | 'top' | 'bottom' | 'middle';

export type D3AnnotationLineType = 'horizontal' | 'vertical' | 'none';

export type D3AnnotationConnector = {
  type?: D3AnnotationConnectorType;
  end?: 'arrow' | 'dot' | 'none';
  points?: Array<Point | [number, number]>;
  startOffset?: number;
  endOffset?: number;
  className?: string;
  data?: DataAttributes;
};

export type D3AnnotationSubjectPoint = Point | readonly [number, number];
export type D3AnnotationBadgeX = 'left' | 'center' | 'right';
export type D3AnnotationBadgeY = 'top' | 'center' | 'bottom';

export type D3AnnotationNote = {
  title?: string;
  label?: string;
  body?: string;
  ariaLabel?: string;
  align?: D3AnnotationAlign;
  orientation?: D3AnnotationOrientation;
  wrap?: number;
  wrapSplitter?: string | RegExp;
  maxLines?: number;
  padding?: AnnotationNote['padding'];
  bgPadding?: AnnotationNote['padding'];
  lineType?: D3AnnotationLineType;
  line?: AnnotationNote['line'];
  className?: string;
  data?: DataAttributes;
  metadata?: AnnotationNote['metadata'];
};

export type D3AnnotationSubject = {
  radius?: number;
  radiusPadding?: number;
  outerRadius?: number;
  innerRadius?: number;
  width?: number;
  height?: number;
  x?: number | D3AnnotationBadgeX;
  y?: number | D3AnnotationBadgeY;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  text?: string;
  label?: string;
  points?: D3AnnotationSubjectPoint[];
  pointRadius?: number;
  padding?: number;
  className?: string;
  data?: DataAttributes;
};

export type D3StyleAnnotationInput<TDatum = unknown> = {
  id?: string;
  type?: D3AnnotationType;
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  nx?: number;
  ny?: number;
  note?: D3AnnotationNote;
  subject?: D3AnnotationSubject;
  connector?: D3AnnotationConnector;
  disable?: D3AnnotationDisablePart[];
  data?: TDatum;
  annotationData?: DataAttributes;
  className?: string;
  color?: string;
  style?: AnnotationStyle;
  priority?: number;
  variant?: AnnotationVariant;
  tone?: AnnotationTone;
  motion?: AnnotationMotion;
  placement?: PlacementPreference;
  metadata?: Annotation['metadata'];
};

export type D3AnnotationAccessor<TDatum = unknown> =
  | keyof TDatum
  | ((datum: TDatum, annotation: D3StyleAnnotationInput<TDatum>, index: number) => number);

export type D3AnnotationInverseAccessor<TDatum = unknown> =
  | keyof TDatum
  | ((
    value: number,
    datum: TDatum | undefined,
    annotation: D3StyleAnnotationInput<TDatum>,
    index: number,
    field: 'x' | 'y'
  ) => TDatum | Partial<TDatum> | void);

export type D3StyleAnnotationOptions<TDatum = unknown> = {
  idPrefix?: string;
  x?: D3AnnotationAccessor<TDatum>;
  y?: D3AnnotationAccessor<TDatum>;
  defaultType?: D3AnnotationType;
};

export type D3StyleAnnotationCollectionId<TDatum = unknown> =
  | string[]
  | ((annotation: D3StyleAnnotationInput<TDatum>, index: number) => string | undefined);

export type D3StyleAnnotationCollectionInput<TDatum = unknown> = {
  annotations: Array<D3StyleAnnotationInput<TDatum>>;
  type?: D3AnnotationType | D3StyleCustomAnnotationType<TDatum>;
  accessors?: Partial<Record<'x' | 'y', D3AnnotationAccessor<TDatum>>>;
  accessorsInverse?: Partial<Record<'x' | 'y', D3AnnotationInverseAccessor<TDatum>>>;
  ids?: D3StyleAnnotationCollectionId<TDatum>;
  disable?: D3AnnotationDisablePart[];
  editMode?: boolean;
  notePadding?: AnnotationNote['padding'];
  textWrap?: number;
  idPrefix?: string;
};

export type PreparedD3StyleAnnotationCollection<TDatum = unknown> = {
  annotations: Annotation[];
  styleAnnotations: Array<D3StyleAnnotationInput<TDatum>>;
  editMode: boolean;
};

export type D3StyleCustomAnnotationContext<TDatum = unknown> = {
  input: D3StyleAnnotationInput<TDatum>;
  mergedInput: D3StyleAnnotationInput<TDatum>;
  options: D3StyleAnnotationOptions<TDatum>;
  index: number;
};

export type D3StyleCustomAnnotationDefinition<TDatum = unknown> = {
  baseType?: D3AnnotationType;
  defaults?: Partial<D3StyleAnnotationInput<TDatum>>;
  transform?: (
    annotation: Annotation,
    context: D3StyleCustomAnnotationContext<TDatum>
  ) => Annotation;
};

export type D3StyleCustomAnnotationType<TDatum = unknown> = (
  input: D3StyleAnnotationInput<TDatum>,
  options?: D3StyleAnnotationOptions<TDatum>,
  index?: number
) => Annotation;

export type D3StyleAnnotationEditOptions<TDatum = unknown> = D3StyleAnnotationOptions<TDatum> & {
  accessorsInverse?: Partial<Record<'x' | 'y', D3AnnotationInverseAccessor<TDatum>>>;
};

export type D3StyleAnnotationEditPatch<TDatum = unknown> = Partial<Pick<
  D3StyleAnnotationInput<TDatum>,
  'x' | 'y' | 'dx' | 'dy' | 'nx' | 'ny' | 'data' | 'placement' | 'subject'
>>;

export type D3StyleAnnotationCollectionEditPatch<TDatum = unknown> = {
  index: number;
  id: string;
  annotation: D3StyleAnnotationEditPatch<TDatum>;
};

export type D3StyleAnnotationBuilderInput<TDatum = unknown> =
  Omit<D3StyleAnnotationCollectionInput<TDatum>, 'annotations'>
  & { annotations?: Array<D3StyleAnnotationInput<TDatum>> };

export type D3StyleAnnotationBuilder<TDatum = unknown> = {
  annotations(): Array<D3StyleAnnotationInput<TDatum>>;
  annotations(annotations: Array<D3StyleAnnotationInput<TDatum>>): D3StyleAnnotationBuilder<TDatum>;
  type(): D3StyleAnnotationCollectionInput<TDatum>['type'] | undefined;
  type(type: D3StyleAnnotationCollectionInput<TDatum>['type'] | undefined): D3StyleAnnotationBuilder<TDatum>;
  accessors(): D3StyleAnnotationCollectionInput<TDatum>['accessors'];
  accessors(accessors: D3StyleAnnotationCollectionInput<TDatum>['accessors']): D3StyleAnnotationBuilder<TDatum>;
  accessorsInverse(): D3StyleAnnotationCollectionInput<TDatum>['accessorsInverse'];
  accessorsInverse(accessors: D3StyleAnnotationCollectionInput<TDatum>['accessorsInverse']): D3StyleAnnotationBuilder<TDatum>;
  ids(): D3StyleAnnotationCollectionInput<TDatum>['ids'];
  ids(ids: D3StyleAnnotationCollectionInput<TDatum>['ids']): D3StyleAnnotationBuilder<TDatum>;
  disable(): D3StyleAnnotationCollectionInput<TDatum>['disable'];
  disable(disable: D3StyleAnnotationCollectionInput<TDatum>['disable']): D3StyleAnnotationBuilder<TDatum>;
  editMode(): boolean;
  editMode(editMode: boolean): D3StyleAnnotationBuilder<TDatum>;
  notePadding(): D3StyleAnnotationCollectionInput<TDatum>['notePadding'];
  notePadding(padding: D3StyleAnnotationCollectionInput<TDatum>['notePadding']): D3StyleAnnotationBuilder<TDatum>;
  textWrap(): D3StyleAnnotationCollectionInput<TDatum>['textWrap'];
  textWrap(textWrap: D3StyleAnnotationCollectionInput<TDatum>['textWrap']): D3StyleAnnotationBuilder<TDatum>;
  idPrefix(): D3StyleAnnotationCollectionInput<TDatum>['idPrefix'];
  idPrefix(idPrefix: D3StyleAnnotationCollectionInput<TDatum>['idPrefix']): D3StyleAnnotationBuilder<TDatum>;
  config(): D3StyleAnnotationCollectionInput<TDatum>;
  prepare(): PreparedD3StyleAnnotationCollection<TDatum>;
  toAnnotations(): Annotation[];
  editPatch(edit: AnnotationEditSuggestion | AnnotationEditPatch): D3StyleAnnotationCollectionEditPatch<TDatum>;
  applyEdit(edit: AnnotationEditSuggestion | AnnotationEditPatch): D3StyleAnnotationBuilder<TDatum>;
};

