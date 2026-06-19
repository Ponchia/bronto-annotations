import { annotationEditPatch } from '../core/edit.js';
import { enclosingCircle } from '../core/annotation-geometry.js';
import type {
  AnnotationEditPatch,
  AnnotationEditSuggestion
} from '../core/edit.js';
import type {
  Anchor,
  Annotation,
  AnnotationBadgeOptions,
  AnnotationConnectorOptions,
  AnnotationMetadata,
  AnnotationNote,
  AnnotationSubjectOptions,
  AnnotationStyle,
  AnnotationMotion,
  AnnotationTone,
  AnnotationVariant,
  Box,
  DataAttributes,
  PlacementPreference,
  PlacementSide,
  Point
} from '../core/model.js';

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

export type AnnotationPresetBase = {
  id: string;
  note: AnnotationNote;
  placement?: PlacementPreference;
  priority?: number;
  variant?: AnnotationVariant;
  tone?: AnnotationTone;
  motion?: AnnotationMotion;
  style?: AnnotationStyle;
  className?: string;
  data?: DataAttributes;
  metadata?: AnnotationMetadata;
};

export type PointCalloutOptions = AnnotationPresetBase & {
  point: Point;
  radius?: number;
  connector?: AnnotationConnectorOptions;
};

export type RegionCalloutOptions = AnnotationPresetBase & {
  box: Box;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
};

export type PathCalloutOptions = AnnotationPresetBase & {
  points: Point[];
  connector?: AnnotationConnectorOptions;
};

export type EncircleCalloutOptions = AnnotationPresetBase & {
  points: Point[];
  pointRadius?: number;
  padding?: number;
  subject?: Omit<AnnotationSubjectOptions, 'geometry' | 'geometrySpace'>;
  connector?: AnnotationConnectorOptions;
};

export type ThresholdAnnotationOptions = AnnotationPresetBase & {
  orientation: 'horizontal' | 'vertical';
  value: number;
  range: [number, number];
  subjectPadding?: number;
  connector?: AnnotationConnectorOptions;
};

export type BadgeAnnotationOptions = AnnotationPresetBase & {
  point: Point;
  radius?: number;
  label?: string;
  badge?: AnnotationBadgeOptions;
  showNote?: boolean;
};

export function pointCallout(options: PointCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'point', point: options.point },
    variant: options.variant ?? 'circle',
    subject: {
      shape: 'circle',
      radius: options.radius ?? 6
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function regionCallout(options: RegionCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'box', box: options.box },
    variant: options.variant ?? 'rect',
    subject: {
      shape: 'rect',
      padding: 4,
      ...options.subject
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function pathCallout(options: PathCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'path', points: options.points },
    variant: options.variant ?? 'curve',
    subject: {
      shape: 'path'
    },
    connector: {
      type: 'curve',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function encircleCallout(options: EncircleCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'path', points: options.points },
    variant: options.variant ?? 'cluster',
    subject: {
      shape: 'path',
      ...(options.subject ?? {}),
      geometry: {
        type: 'encircle',
        points: options.points,
        ...(options.pointRadius !== undefined ? { radius: options.pointRadius } : {}),
        ...(options.padding !== undefined ? { padding: options.padding } : {})
      },
      geometrySpace: 'absolute'
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function thresholdAnnotation(options: ThresholdAnnotationOptions): Annotation {
  const [start, end] = options.range;
  const points = options.orientation === 'horizontal'
    ? [
      { x: start, y: options.value },
      { x: end, y: options.value }
    ]
    : [
      { x: options.value, y: start },
      { x: options.value, y: end }
    ];

  return annotation({
    ...options,
    anchor: { type: 'path', points },
    variant: options.variant ?? 'threshold',
    subject: {
      shape: 'path',
      padding: options.subjectPadding ?? 0
    },
    connector: {
      type: 'elbow',
      end: 'none',
      ...options.connector
    }
  });
}

export function badgeAnnotation(options: BadgeAnnotationOptions): Annotation {
  const radius = options.badge?.radius ?? options.radius ?? 12;

  return annotation({
    ...options,
    note: options.showNote ? options.note : { ...options.note, visible: false },
    anchor: { type: 'point', point: options.point },
    variant: options.variant ?? 'badge',
    subject: {
      shape: 'circle',
      radius,
      badge: {
        label: options.badge?.label ?? options.label ?? options.note.title ?? options.id,
        radius,
        ...options.badge
      }
    },
    connector: {
      type: 'none',
      end: 'none'
    },
    placement: {
      side: ['top', 'right', 'bottom', 'left'],
      offset: options.placement?.offset ?? 4,
      ...(options.placement ?? {})
    }
  });
}

export function defineD3StyleAnnotationType<TDatum = unknown>(
  definition: D3StyleCustomAnnotationDefinition<TDatum>
): D3StyleCustomAnnotationType<TDatum> {
  const fallbackType = definition.baseType ?? definition.defaults?.type ?? 'callout';

  return (input, options = {}, index = 0) => {
    const mergedInput = mergeD3StyleAnnotationInput(definition.defaults, input, fallbackType);
    const annotation = annotationFromD3Style(mergedInput, options, index);

    return definition.transform
      ? definition.transform(annotation, { input, mergedInput, options, index })
      : annotation;
  };
}

export function annotationsFromD3StyleType<TDatum = unknown>(
  type: D3StyleCustomAnnotationType<TDatum>,
  annotations: Array<D3StyleAnnotationInput<TDatum>>,
  options: D3StyleAnnotationOptions<TDatum> = {}
): Annotation[] {
  return annotations.map((input, index) => type(input, options, index));
}

export function annotationFromD3Style<TDatum = unknown>(
  input: D3StyleAnnotationInput<TDatum>,
  options: D3StyleAnnotationOptions<TDatum> = {},
  index = 0
): Annotation {
  const type = normalizeD3AnnotationType(input.type ?? options.defaultType ?? 'callout');
  const subject = input.subject ?? {};
  const encircle = d3EncircleSubject(subject);
  const x = coordinate(input, options.x, 'x', index, encircle?.x);
  const y = coordinate(input, options.y, 'y', index, encircle?.y);
  const disabled = new Set(input.disable ?? []);
  const id = input.id ?? `${options.idPrefix ?? 'annotation'}-${index + 1}`;
  const connector = d3Connector(type, input.connector, subject, disabled, encircle);
  const annotationSubject = d3Subject(type, subject, disabled, encircle);
  const note = d3Note(input.note, type, disabled);
  const placement = d3Placement(x, y, input.dx, input.dy, input.nx, input.ny, input.placement);
  const anchor = d3Anchor(type, x, y, subject);
  const variant = input.variant ?? variantForD3Type(type);
  const metadata: AnnotationMetadata = {
    ...(input.metadata ?? {}),
    ...(input.data === undefined ? {} : { datum: input.data }),
    d3AnnotationType: type,
    ...(input.color ? { color: input.color } : {})
  };
  const data = mergeObjects(
    input.color ? { color: input.color } : undefined,
    input.annotationData
  );
  const style = mergeObjects(
    input.color ? { color: input.color, lineColor: input.color } : undefined,
    input.style
  );

  return {
    id,
    anchor,
    note,
    ...(placement ? { placement } : {}),
    ...(annotationSubject ? { subject: annotationSubject } : {}),
    ...(connector ? { connector } : {}),
    variant,
    ...(input.tone ? { tone: input.tone } : {}),
    ...(input.motion ? { motion: input.motion } : {}),
    ...(style ? { style } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.className ? { className: input.className } : {}),
    ...(data ? { data } : {}),
    metadata
  };
}

export function annotationsFromD3Style<TDatum = unknown>(
  annotations: Array<D3StyleAnnotationInput<TDatum>>,
  options: D3StyleAnnotationOptions<TDatum> = {}
): Annotation[] {
  return annotations.map((input, index) => annotationFromD3Style(input, options, index));
}

export function prepareD3StyleAnnotationCollection<TDatum = unknown>(
  collection: D3StyleAnnotationCollectionInput<TDatum>
): PreparedD3StyleAnnotationCollection<TDatum> {
  const styleAnnotations = collection.annotations.map((input, index) => d3CollectionAnnotationInput(input, collection, index));
  const options = d3CollectionOptions(collection);
  const annotations = typeof collection.type === 'function'
    ? annotationsFromD3StyleType(collection.type, styleAnnotations, options)
    : annotationsFromD3Style(styleAnnotations, {
      ...options,
      ...(collection.type ? { defaultType: collection.type } : {})
    });

  return {
    annotations,
    styleAnnotations,
    editMode: collection.editMode ?? false
  };
}

export function annotationsFromD3StyleCollection<TDatum = unknown>(
  collection: D3StyleAnnotationCollectionInput<TDatum>
): Annotation[] {
  return prepareD3StyleAnnotationCollection(collection).annotations;
}

export function d3StyleAnnotationEditPatch<TDatum = unknown>(
  input: D3StyleAnnotationInput<TDatum>,
  edit: AnnotationEditSuggestion | AnnotationEditPatch,
  options: D3StyleAnnotationEditOptions<TDatum> = {},
  index = 0
): D3StyleAnnotationEditPatch<TDatum> {
  const patch = annotationEditPatch(edit);
  let nextInput = input;
  let result: D3StyleAnnotationEditPatch<TDatum> = {};

  if (patch.anchor) {
    const coordinatePatch = d3CoordinateEditPatch(nextInput, patch.anchor, options, index);
    result = mergeD3EditPatch(result, coordinatePatch);
    nextInput = { ...nextInput, ...coordinatePatch };
  }

  if (patch.placement?.manual) {
    const x = coordinate(nextInput, options.x, 'x', index);
    const y = coordinate(nextInput, options.y, 'y', index);
    const notePosition = nextInput.nx !== undefined || nextInput.ny !== undefined
      ? {
        nx: round(patch.placement.manual.x),
        ny: round(patch.placement.manual.y)
      }
      : {
        dx: round(patch.placement.manual.x - x),
        dy: round(patch.placement.manual.y - y)
      };

    result = mergeD3EditPatch(result, {
      ...notePosition,
      placement: {
        ...(input.placement ?? {}),
        ...patch.placement,
        manual: {
          ...(input.placement?.manual ?? {}),
          ...patch.placement.manual
        }
      }
    });
  }

  return result;
}

export function applyD3StyleAnnotationEdit<TDatum = unknown>(
  input: D3StyleAnnotationInput<TDatum>,
  edit: AnnotationEditSuggestion | AnnotationEditPatch,
  options: D3StyleAnnotationEditOptions<TDatum> = {},
  index = 0
): D3StyleAnnotationInput<TDatum> {
  return {
    ...input,
    ...d3StyleAnnotationEditPatch(input, edit, options, index)
  };
}

export function d3StyleAnnotationCollectionEditPatch<TDatum = unknown>(
  collection: D3StyleAnnotationCollectionInput<TDatum>,
  edit: AnnotationEditSuggestion | AnnotationEditPatch
): D3StyleAnnotationCollectionEditPatch<TDatum> {
  const patch = annotationEditPatch(edit);
  const prepared = prepareD3StyleAnnotationCollection(collection);
  const index = prepared.annotations.findIndex((annotation) => annotation.id === patch.annotationId);

  if (index === -1) {
    throw new Error(`D3-style annotation collection edit target not found: ${patch.annotationId}.`);
  }

  return {
    index,
    id: patch.annotationId,
    annotation: d3StyleAnnotationEditPatch(
      prepared.styleAnnotations[index]!,
      patch,
      d3CollectionEditOptions(collection),
      index
    )
  };
}

export function applyD3StyleAnnotationCollectionEdit<TDatum = unknown>(
  collection: D3StyleAnnotationCollectionInput<TDatum>,
  edit: AnnotationEditSuggestion | AnnotationEditPatch
): D3StyleAnnotationCollectionInput<TDatum> {
  const patch = d3StyleAnnotationCollectionEditPatch(collection, edit);

  return {
    ...collection,
    annotations: collection.annotations.map((annotation, index) => index === patch.index
      ? {
        ...annotation,
        ...patch.annotation
      }
      : annotation)
  };
}

export function createD3StyleAnnotationBuilder<TDatum = unknown>(
  initial: D3StyleAnnotationBuilderInput<TDatum> = {}
): D3StyleAnnotationBuilder<TDatum> {
  let state = normalizeD3BuilderInput(initial);
  const builder = {} as D3StyleAnnotationBuilder<TDatum>;

  builder.annotations = (function annotations(annotations?: Array<D3StyleAnnotationInput<TDatum>>) {
    if (arguments.length === 0) {
      return [...state.annotations];
    }

    state = { ...state, annotations: annotations ?? [] };

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['annotations'];

  builder.type = (function type(type?: D3StyleAnnotationCollectionInput<TDatum>['type']) {
    if (arguments.length === 0) {
      return state.type;
    }

    state = compactUndefined({ ...state, type }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['type'];

  builder.accessors = (function accessors(accessors?: D3StyleAnnotationCollectionInput<TDatum>['accessors']) {
    if (arguments.length === 0) {
      return state.accessors;
    }

    state = compactUndefined({ ...state, accessors }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['accessors'];

  builder.accessorsInverse = (function accessorsInverse(accessorsInverse?: D3StyleAnnotationCollectionInput<TDatum>['accessorsInverse']) {
    if (arguments.length === 0) {
      return state.accessorsInverse;
    }

    state = compactUndefined({ ...state, accessorsInverse }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['accessorsInverse'];

  builder.ids = (function ids(ids?: D3StyleAnnotationCollectionInput<TDatum>['ids']) {
    if (arguments.length === 0) {
      return state.ids;
    }

    state = compactUndefined({ ...state, ids }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['ids'];

  builder.disable = (function disable(disable?: D3StyleAnnotationCollectionInput<TDatum>['disable']) {
    if (arguments.length === 0) {
      return state.disable;
    }

    state = compactUndefined({ ...state, disable }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['disable'];

  builder.editMode = (function editMode(editMode?: boolean) {
    if (arguments.length === 0) {
      return state.editMode ?? false;
    }

    state = { ...state, editMode: editMode ?? false };

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['editMode'];

  builder.notePadding = (function notePadding(notePadding?: D3StyleAnnotationCollectionInput<TDatum>['notePadding']) {
    if (arguments.length === 0) {
      return state.notePadding;
    }

    state = compactUndefined({ ...state, notePadding }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['notePadding'];

  builder.textWrap = (function textWrap(textWrap?: D3StyleAnnotationCollectionInput<TDatum>['textWrap']) {
    if (arguments.length === 0) {
      return state.textWrap;
    }

    state = compactUndefined({ ...state, textWrap }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['textWrap'];

  builder.idPrefix = (function idPrefix(idPrefix?: D3StyleAnnotationCollectionInput<TDatum>['idPrefix']) {
    if (arguments.length === 0) {
      return state.idPrefix;
    }

    state = compactUndefined({ ...state, idPrefix }) as D3StyleAnnotationCollectionInput<TDatum>;

    return builder;
  }) as D3StyleAnnotationBuilder<TDatum>['idPrefix'];

  builder.config = () => ({
    ...state,
    annotations: [...state.annotations]
  });
  builder.prepare = () => prepareD3StyleAnnotationCollection(state);
  builder.toAnnotations = () => annotationsFromD3StyleCollection(state);
  builder.editPatch = (edit) => d3StyleAnnotationCollectionEditPatch(state, edit);
  builder.applyEdit = (edit) => {
    state = applyD3StyleAnnotationCollectionEdit(state, edit);

    return builder;
  };

  return builder;
}

function annotation(input: AnnotationPresetBase & {
  anchor: Anchor;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
}): Annotation {
  return {
    id: input.id,
    anchor: input.anchor,
    note: input.note,
    ...(input.placement ? { placement: input.placement } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.connector ? { connector: input.connector } : {}),
    ...(input.variant ? { variant: input.variant } : {}),
    ...(input.tone ? { tone: input.tone } : {}),
    ...(input.motion ? { motion: input.motion } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.className ? { className: input.className } : {}),
    ...(input.data ? { data: input.data } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

function mergeD3StyleAnnotationInput<TDatum>(
  defaults: Partial<D3StyleAnnotationInput<TDatum>> | undefined,
  input: D3StyleAnnotationInput<TDatum>,
  fallbackType: D3AnnotationType
): D3StyleAnnotationInput<TDatum> {
  const merged = {
    ...(defaults ?? {}),
    ...input,
    type: input.type ?? defaults?.type ?? fallbackType,
    note: mergeObjects(defaults?.note, input.note),
    subject: mergeObjects(defaults?.subject, input.subject),
    connector: mergeObjects(defaults?.connector, input.connector),
    placement: mergePlacementPreference(defaults?.placement, input.placement),
    style: mergeObjects(defaults?.style, input.style),
    metadata: mergeObjects(defaults?.metadata, input.metadata),
    data: mergeObjects(defaults?.data, input.data),
    annotationData: mergeObjects(defaults?.annotationData, input.annotationData),
    disable: input.disable ?? defaults?.disable
  };

  return compactUndefined(merged) as D3StyleAnnotationInput<TDatum>;
}

function mergePlacementPreference(
  defaults: PlacementPreference | undefined,
  input: PlacementPreference | undefined
): PlacementPreference | undefined {
  if (!defaults) {
    return input;
  }

  if (!input) {
    return defaults;
  }

  const merged = {
    ...defaults,
    ...input
  };

  const baseManual = defaults.manual ?? input.manual;

  if (baseManual) {
    return {
      ...merged,
      manual: {
        ...baseManual,
        ...(input.manual ?? {})
      }
    };
  }

  return merged;
}

function d3CollectionOptions<TDatum>(
  collection: D3StyleAnnotationCollectionInput<TDatum>
): D3StyleAnnotationOptions<TDatum> {
  return {
    ...(collection.idPrefix ? { idPrefix: collection.idPrefix } : {}),
    ...(collection.accessors?.x ? { x: collection.accessors.x } : {}),
    ...(collection.accessors?.y ? { y: collection.accessors.y } : {})
  };
}

function normalizeD3BuilderInput<TDatum>(
  input: D3StyleAnnotationBuilderInput<TDatum>
): D3StyleAnnotationCollectionInput<TDatum> {
  return compactUndefined({
    ...input,
    annotations: input.annotations ?? []
  }) as D3StyleAnnotationCollectionInput<TDatum>;
}

function d3CollectionEditOptions<TDatum>(
  collection: D3StyleAnnotationCollectionInput<TDatum>
): D3StyleAnnotationEditOptions<TDatum> {
  return {
    ...d3CollectionOptions(collection),
    ...(collection.accessorsInverse ? { accessorsInverse: collection.accessorsInverse } : {})
  };
}

function d3CollectionAnnotationInput<TDatum>(
  input: D3StyleAnnotationInput<TDatum>,
  collection: D3StyleAnnotationCollectionInput<TDatum>,
  index: number
): D3StyleAnnotationInput<TDatum> {
  const id = input.id ?? d3CollectionId(collection.ids, input, index);
  const type = typeof collection.type === 'string' && input.type === undefined
    ? collection.type
    : input.type;
  const note = d3CollectionNote(input.note, collection);

  return compactUndefined({
    ...input,
    ...(id ? { id } : {}),
    ...(type ? { type } : {}),
    ...(input.disable === undefined && collection.disable ? { disable: collection.disable } : {}),
    ...(note ? { note } : {})
  }) as D3StyleAnnotationInput<TDatum>;
}

function d3CollectionId<TDatum>(
  ids: D3StyleAnnotationCollectionId<TDatum> | undefined,
  annotationInput: D3StyleAnnotationInput<TDatum>,
  index: number
): string | undefined {
  if (Array.isArray(ids)) {
    return ids[index];
  }

  return ids?.(annotationInput, index);
}

function d3CollectionNote<TDatum>(
  note: D3AnnotationNote | undefined,
  collection: D3StyleAnnotationCollectionInput<TDatum>
): D3AnnotationNote | undefined {
  if (collection.notePadding === undefined && collection.textWrap === undefined) {
    return note;
  }

  return compactUndefined({
    ...(note ?? {}),
    ...(collection.notePadding !== undefined && note?.padding === undefined && note?.bgPadding === undefined
      ? { padding: collection.notePadding }
      : {}),
    ...(collection.textWrap !== undefined && note?.wrap === undefined
      ? { wrap: collection.textWrap }
      : {})
  }) as D3AnnotationNote;
}

function mergeObjects<T>(defaults: T | undefined, input: T | undefined): T | undefined {
  if (defaults === undefined) {
    return input;
  }

  if (input === undefined) {
    return defaults;
  }

  if (isObject(defaults) && isObject(input)) {
    return {
      ...defaults,
      ...input
    } as T;
  }

  return input;
}

function compactUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

type NormalizedD3AnnotationType =
  | 'label'
  | 'callout'
  | 'callout-elbow'
  | 'callout-curve'
  | 'callout-circle'
  | 'callout-rect'
  | 'xy-threshold'
  | 'badge';

type D3ComputedEncircleSubject = {
  points: Point[];
  x: number;
  y: number;
  radius: number;
  pointRadius: number;
  padding: number;
};

function normalizeD3AnnotationType(type: D3AnnotationType): NormalizedD3AnnotationType {
  switch (type) {
    case 'label':
    case 'annotationLabel':
      return 'label';
    case 'callout':
    case 'annotationCallout':
      return 'callout';
    case 'callout-elbow':
    case 'annotationCalloutElbow':
      return 'callout-elbow';
    case 'callout-curve':
    case 'annotationCalloutCurve':
      return 'callout-curve';
    case 'callout-circle':
    case 'annotationCalloutCircle':
      return 'callout-circle';
    case 'callout-rect':
    case 'annotationCalloutRect':
      return 'callout-rect';
    case 'xy-threshold':
    case 'annotationXYThreshold':
      return 'xy-threshold';
    case 'badge':
    case 'annotationBadge':
      return 'badge';
  }
}

function d3EncircleSubject(subject: D3AnnotationSubject): D3ComputedEncircleSubject | undefined {
  if (!subject.points || subject.points.length === 0) {
    return undefined;
  }

  const points = subject.points.map(normalizeD3SubjectPoint);
  const pointRadius = positiveDimension(subject.pointRadius, 'subject.pointRadius', 0);
  const padding = positiveDimension(subject.padding ?? subject.radiusPadding, 'subject.padding', 0);
  const circle = enclosingCircle(points);
  const radius = circle.radius + pointRadius + padding;

  return {
    points,
    x: circle.x,
    y: circle.y,
    radius,
    pointRadius,
    padding
  };
}

function normalizeD3SubjectPoint(point: D3AnnotationSubjectPoint): Point {
  if (!('x' in point)) {
    return {
      x: finite(point[0], 'subject.points[].0'),
      y: finite(point[1], 'subject.points[].1')
    };
  }

  return {
    x: finite(point.x, 'subject.points[].x'),
    y: finite(point.y, 'subject.points[].y')
  };
}

function coordinate<TDatum>(
  input: D3StyleAnnotationInput<TDatum>,
  accessor: D3AnnotationAccessor<TDatum> | undefined,
  field: 'x' | 'y',
  index: number,
  fallback?: number
): number {
  const direct = input[field];

  if (Number.isFinite(direct)) {
    return direct as number;
  }

  if (input.data !== undefined && accessor !== undefined) {
    const value = typeof accessor === 'function'
      ? accessor(input.data, input, index)
      : (input.data as Record<PropertyKey, unknown>)[accessor as PropertyKey];

    if (Number.isFinite(value)) {
      return value as number;
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new TypeError(`d3-style annotation ${field} coordinate must be finite`);
}

function d3Anchor(
  type: NormalizedD3AnnotationType,
  x: number,
  y: number,
  subject: D3AnnotationSubject
): Anchor {
  if (type === 'callout-rect') {
    const width = signedDimension(subject.width, 'subject.width', 0);
    const height = signedDimension(subject.height, 'subject.height', 0);

    if (width !== 0 && height !== 0) {
      const rawX = x + finite(subject.x, 'subject.x', -width / 2);
      const rawY = y + finite(subject.y, 'subject.y', -height / 2);

      return {
        type: 'box',
        box: {
          x: Math.min(rawX, rawX + width),
          y: Math.min(rawY, rawY + height),
          width: Math.abs(width),
          height: Math.abs(height)
        }
      };
    }
  }

  if (type === 'xy-threshold') {
    const points = thresholdPoints(x, y, subject);

    if (points) {
      return { type: 'path', points };
    }
  }

  return { type: 'point', point: { x, y } };
}

function d3Subject(
  type: NormalizedD3AnnotationType,
  subject: D3AnnotationSubject,
  disabled: Set<D3AnnotationDisablePart>,
  encircle?: D3ComputedEncircleSubject
): AnnotationSubjectOptions | undefined {
  if (disabled.has('subject')) {
    return { shape: 'none' };
  }

  if (type === 'label' || type === 'callout' || type === 'callout-elbow' || type === 'callout-curve') {
    return { shape: 'none' };
  }

  if (type === 'callout-circle') {
    if (encircle) {
      return {
        shape: 'path',
        geometry: {
          type: 'encircle',
          points: encircle.points,
          radius: encircle.pointRadius,
          padding: encircle.padding
        },
        geometrySpace: 'absolute',
        ...(subject.className ? { className: subject.className } : {}),
        ...(subject.data ? { data: subject.data } : {})
      };
    }

    return {
      shape: 'circle',
      radius: circleRadius(subject),
      ...(subject.className ? { className: subject.className } : {}),
      ...(subject.data ? { data: subject.data } : {})
    };
  }

  if (type === 'callout-rect') {
    return {
      shape: 'rect',
      ...(subject.className ? { className: subject.className } : {}),
      ...(subject.data ? { data: subject.data } : {})
    };
  }

  if (type === 'xy-threshold') {
    return {
      shape: 'path',
      ...(subject.className ? { className: subject.className } : {}),
      ...(subject.data ? { data: subject.data } : {})
    };
  }

  const label = subject.text ?? subject.label;
  const radius = positiveDimension(subject.radius, 'subject.radius', 12);
  const badgeX = d3BadgeX(subject.x);
  const badgeY = d3BadgeY(subject.y);

  return {
    shape: 'circle',
    radius,
    ...(subject.className ? { className: subject.className } : {}),
    ...(subject.data ? { data: subject.data } : {}),
    badge: {
      ...(label ? { label } : {}),
      radius,
      ...(badgeX ? { x: badgeX } : {}),
      ...(badgeY ? { y: badgeY } : {}),
      ...(subject.className ? { className: subject.className } : {}),
      ...(subject.data ? { data: subject.data } : {})
    }
  };
}

function d3BadgeX(value: D3AnnotationSubject['x']): AnnotationBadgeOptions['x'] | undefined {
  return value === 'left' || value === 'center' || value === 'right'
    ? value
    : undefined;
}

function d3BadgeY(value: D3AnnotationSubject['y']): AnnotationBadgeOptions['y'] | undefined {
  return value === 'top' || value === 'center' || value === 'bottom'
    ? value
    : undefined;
}

function d3Connector(
  type: NormalizedD3AnnotationType,
  connector: D3AnnotationConnector | undefined,
  subject: D3AnnotationSubject,
  disabled: Set<D3AnnotationDisablePart>,
  encircle?: D3ComputedEncircleSubject
): AnnotationConnectorOptions {
  if (disabled.has('connector') || type === 'label' || type === 'badge') {
    return { type: 'none', end: 'none' };
  }

  const connectorType = connector?.type
    ? normalizeConnectorType(connector.type)
    : defaultConnectorType(type);
  const points = connector?.points?.map(normalizeConnectorPoint);
  const startOffset = connector?.startOffset
    ?? (type === 'callout-circle'
      ? encircle?.radius ?? circleRadius(subject) + finite(subject.radiusPadding, 'subject.radiusPadding', 0)
      : undefined);

  return {
    type: connectorType,
    end: connector?.end ?? 'none',
    ...(points?.length ? { points, pointMode: 'relative' } : {}),
    ...(startOffset !== undefined ? { startOffset } : {}),
    ...(connector?.endOffset !== undefined ? { endOffset: connector.endOffset } : {}),
    ...(connector?.className ? { className: connector.className } : {}),
    ...(connector?.data ? { data: connector.data } : {})
  };
}

function d3Note(
  note: D3AnnotationNote | undefined,
  type: NormalizedD3AnnotationType,
  disabled: Set<D3AnnotationDisablePart>
): AnnotationNote {
  const visible = disabled.has('note') || type === 'badge' ? false : undefined;
  const line = d3NoteLine(note, type);
  const padding = note?.padding ?? note?.bgPadding;
  const align = d3NoteAlign(note?.align);

  return {
    ...(note?.title ? { title: note.title } : {}),
    ...(note?.body ?? note?.label ? { body: note.body ?? note.label } : {}),
    ...(note?.ariaLabel ? { ariaLabel: note.ariaLabel } : {}),
    ...(align ? { align } : {}),
    ...(note?.wrap !== undefined ? { wrap: note.wrap } : {}),
    ...(note?.wrapSplitter !== undefined ? { wrapSplitter: note.wrapSplitter } : {}),
    ...(note?.maxLines !== undefined ? { maxLines: note.maxLines } : {}),
    ...(padding !== undefined ? { padding } : {}),
    ...(line !== undefined ? { line } : {}),
    ...(visible !== undefined ? { visible } : {}),
    ...(note?.className ? { className: note.className } : {}),
    ...(note?.data ? { data: note.data } : {}),
    ...(note?.metadata ? { metadata: note.metadata } : {})
  };
}

function d3NoteAlign(align: D3AnnotationAlign | undefined): AnnotationNote['align'] | undefined {
  switch (align) {
    case 'left':
    case 'top':
    case 'start':
      return 'start';
    case 'right':
    case 'bottom':
    case 'end':
      return 'end';
    case 'middle':
    case 'center':
      return 'center';
    case 'dynamic':
    case undefined:
      return undefined;
  }
}

function d3NoteLine(
  note: D3AnnotationNote | undefined,
  type: NormalizedD3AnnotationType
): AnnotationNote['line'] | undefined {
  if (!note && defaultD3NoteLineType(type) === undefined) {
    return undefined;
  }

  if (note?.lineType === 'none') {
    return false;
  }

  if (note?.line === false) {
    return false;
  }

  const base = typeof note?.line === 'object' ? note.line : {};
  const orientation = note?.lineType
    ?? lineTypeFromD3Orientation(note?.orientation)
    ?? defaultD3NoteLineType(type);

  if (!orientation) {
    return note?.line;
  }

  return {
    ...base,
    orientation
  };
}

function defaultD3NoteLineType(type: NormalizedD3AnnotationType): Exclude<D3AnnotationLineType, 'none'> | undefined {
  switch (type) {
    case 'label':
    case 'badge':
      return undefined;
    default:
      return 'horizontal';
  }
}

function lineTypeFromD3Orientation(orientation: D3AnnotationOrientation | undefined): Exclude<D3AnnotationLineType, 'none'> | undefined {
  switch (orientation) {
    case 'topBottom':
    case 'top':
    case 'bottom':
      return 'horizontal';
    case 'leftRight':
    case 'left':
    case 'right':
      return 'vertical';
    case 'fixed':
    case undefined:
      return undefined;
  }
}

function d3Placement(
  x: number,
  y: number,
  dx: number | undefined,
  dy: number | undefined,
  nx: number | undefined,
  ny: number | undefined,
  placement: PlacementPreference | undefined
): PlacementPreference | undefined {
  if (dx === undefined && dy === undefined && nx === undefined && ny === undefined) {
    return placement;
  }

  const manualX = nx !== undefined
    ? finite(nx, 'nx')
    : x + finite(dx, 'dx', 0);
  const manualY = ny !== undefined
    ? finite(ny, 'ny')
    : y + finite(dy, 'dy', 0);

  return {
    ...(placement ?? {}),
    manual: {
      x: manualX,
      y: manualY,
      side: placement?.manual?.side ?? inferSide(manualX - x, manualY - y),
      ...(placement?.manual?.align ? { align: placement.manual.align } : {}),
      ...(placement?.manual?.clamp !== undefined ? { clamp: placement.manual.clamp } : {})
    }
  };
}

function d3CoordinateEditPatch<TDatum>(
  input: D3StyleAnnotationInput<TDatum>,
  anchor: Anchor,
  options: D3StyleAnnotationEditOptions<TDatum>,
  index: number
): D3StyleAnnotationEditPatch<TDatum> {
  if (anchor.type === 'point') {
    return setD3CoordinatePair(input, anchor.point.x, anchor.point.y, options, index);
  }

  if (anchor.type === 'box') {
    const type = normalizeD3AnnotationType(input.type ?? options.defaultType ?? 'callout');
    const subject = input.subject ?? {};

    if (type === 'callout-rect') {
      const width = signedDimension(subject.width, 'subject.width', anchor.box.width);
      const height = signedDimension(subject.height, 'subject.height', anchor.box.height);
      const subjectX = finite(subject.x, 'subject.x', -width / 2);
      const subjectY = finite(subject.y, 'subject.y', -height / 2);

      return setD3CoordinatePair(
        input,
        coordinateFromNormalizedD3Rect(anchor.box.x, subjectX, width),
        coordinateFromNormalizedD3Rect(anchor.box.y, subjectY, height),
        options,
        index
      );
    }

    return setD3CoordinatePair(
      input,
      anchor.box.x + anchor.box.width / 2,
      anchor.box.y + anchor.box.height / 2,
      options,
      index
    );
  }

  if (anchor.points.length > 0) {
    const firstPoint = anchor.points[0] as Point;
    const horizontal = anchor.points.every((point) => Math.abs(point.y - firstPoint.y) < 0.001);
    const vertical = anchor.points.every((point) => Math.abs(point.x - firstPoint.x) < 0.001);

    if (horizontal) {
      return mergeD3EditPatch(
        setD3Coordinate(input, 'y', firstPoint.y, options, index),
        {
          subject: {
            ...(input.subject ?? {}),
            x1: round(Math.min(...anchor.points.map((point) => point.x))),
            x2: round(Math.max(...anchor.points.map((point) => point.x)))
          }
        }
      );
    }

    if (vertical) {
      return mergeD3EditPatch(
        setD3Coordinate(input, 'x', firstPoint.x, options, index),
        {
          subject: {
            ...(input.subject ?? {}),
            y1: round(Math.min(...anchor.points.map((point) => point.y))),
            y2: round(Math.max(...anchor.points.map((point) => point.y)))
          }
        }
      );
    }

    return setD3CoordinatePair(input, firstPoint.x, firstPoint.y, options, index);
  }

  return {};
}

function setD3CoordinatePair<TDatum>(
  input: D3StyleAnnotationInput<TDatum>,
  x: number,
  y: number,
  options: D3StyleAnnotationEditOptions<TDatum>,
  index: number
): D3StyleAnnotationEditPatch<TDatum> {
  const xPatch = setD3Coordinate(input, 'x', x, options, index);
  const afterX = {
    ...input,
    ...xPatch
  };
  const yPatch = setD3Coordinate(afterX, 'y', y, options, index);

  return mergeD3EditPatch(xPatch, yPatch);
}

function setD3Coordinate<TDatum>(
  input: D3StyleAnnotationInput<TDatum>,
  field: 'x' | 'y',
  value: number,
  options: D3StyleAnnotationEditOptions<TDatum>,
  index: number
): D3StyleAnnotationEditPatch<TDatum> {
  const nextValue = round(finite(value, field));
  const inverse = options.accessorsInverse?.[field];

  if (inverse) {
    if (typeof inverse === 'function') {
      const inverseResult = inverse(nextValue, input.data, input, index, field);

      if (inverseResult !== undefined) {
        return { data: mergeDatum(input.data, inverseResult) };
      }
    } else {
      return { data: mergeDatum(input.data, { [inverse]: nextValue } as Partial<TDatum>) };
    }
  }

  const accessor = options[field];

  if (input.data !== undefined && accessor !== undefined && typeof accessor !== 'function') {
    return { data: mergeDatum(input.data, { [accessor]: nextValue } as Partial<TDatum>) };
  }

  return { [field]: nextValue };
}

function mergeD3EditPatch<TDatum>(
  left: D3StyleAnnotationEditPatch<TDatum>,
  right: D3StyleAnnotationEditPatch<TDatum>
): D3StyleAnnotationEditPatch<TDatum> {
  return {
    ...left,
    ...right,
    ...((left.data !== undefined || right.data !== undefined)
      ? { data: mergeDatum(left.data ?? undefined, right.data ?? undefined) }
      : {}),
    ...((left.subject !== undefined || right.subject !== undefined)
      ? { subject: { ...(left.subject ?? {}), ...(right.subject ?? {}) } }
      : {}),
    ...((left.placement !== undefined || right.placement !== undefined)
      ? { placement: { ...(left.placement ?? {}), ...(right.placement ?? {}) } }
      : {})
  };
}

function mergeDatum<TDatum>(
  current: TDatum | undefined,
  patch: TDatum | Partial<TDatum> | undefined
): TDatum {
  if (patch === undefined) {
    return current as TDatum;
  }

  if (isObject(current) && isObject(patch)) {
    return {
      ...current,
      ...patch
    } as TDatum;
  }

  return patch as TDatum;
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function variantForD3Type(type: NormalizedD3AnnotationType): AnnotationVariant {
  switch (type) {
    case 'label':
      return 'label';
    case 'callout-elbow':
      return 'elbow';
    case 'callout-curve':
      return 'curve';
    case 'callout-circle':
      return 'circle';
    case 'callout-rect':
      return 'rect';
    case 'xy-threshold':
      return 'threshold';
    case 'badge':
      return 'badge';
    case 'callout':
    default:
      return 'callout';
  }
}

function defaultConnectorType(type: NormalizedD3AnnotationType): NonNullable<AnnotationConnectorOptions['type']> {
  switch (type) {
    case 'callout-elbow':
      return 'elbow';
    case 'callout-curve':
      return 'curve';
    default:
      return 'straight';
  }
}

function normalizeConnectorType(type: D3AnnotationConnectorType): NonNullable<AnnotationConnectorOptions['type']> {
  return type === 'line' ? 'straight' : type;
}

function normalizeConnectorPoint(point: Point | [number, number]): Point {
  if (Array.isArray(point)) {
    return {
      x: finite(point[0], 'connector.points[].0'),
      y: finite(point[1], 'connector.points[].1')
    };
  }

  return {
    x: finite(point.x, 'connector.points[].x'),
    y: finite(point.y, 'connector.points[].y')
  };
}

function thresholdPoints(x: number, y: number, subject: D3AnnotationSubject): Point[] | undefined {
  if (subject.x1 !== undefined || subject.x2 !== undefined) {
    return [
      { x: finite(subject.x1, 'subject.x1', 0), y },
      { x: finite(subject.x2, 'subject.x2', x), y }
    ];
  }

  if (subject.y1 !== undefined || subject.y2 !== undefined) {
    return [
      { x, y: finite(subject.y1, 'subject.y1', 0) },
      { x, y: finite(subject.y2, 'subject.y2', y) }
    ];
  }

  return undefined;
}

function circleRadius(subject: D3AnnotationSubject): number {
  return positiveDimension(subject.radius ?? subject.outerRadius ?? subject.innerRadius, 'subject.radius', 6);
}

function coordinateFromNormalizedD3Rect(normalizedStart: number, subjectOffset: number, size: number): number {
  return size < 0
    ? normalizedStart - subjectOffset - size
    : normalizedStart - subjectOffset;
}

function positiveDimension(value: number | undefined, name: string, fallback: number): number {
  const resolved = finite(value, name, fallback);

  if (resolved < 0) {
    throw new RangeError(`${name} must be positive`);
  }

  return resolved;
}

function signedDimension(value: number | undefined, name: string, fallback: number): number {
  return finite(value, name, fallback);
}

function finite(value: unknown, name: string, fallback?: number): number {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new TypeError(`${name} must be finite`);
    }

    return fallback;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }

  return value;
}

function inferSide(dx: number, dy: number): PlacementSide {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }

  return dy < 0 ? 'top' : 'bottom';
}
