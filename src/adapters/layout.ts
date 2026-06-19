import type {
  Box,
  LayoutOptions,
  LayoutRefinementOptions,
  PaddingInput,
  PlacementPreference,
  ResolvedLayout
} from '../core/model.js';
import { resolveAnnotationLayout } from '../core/layout.js';
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  type LayoutQualityAssertOptions,
  type LayoutQualityFormatOptions,
  type LayoutQualityReport
} from '../core/quality.js';
import type {
  AdapterAnnotationLayerInput,
  AnchorAlignmentAssertInput,
  AnchorAlignmentFormatOptions,
  AnchorAlignmentOptions,
  AnchorAlignmentReport,
  AnchorAlignmentTarget,
  AnchorSpecValidationReport,
  AnchorValidationAssertOptions,
  AnchorValidationAssertInput,
  AnchorValidationFormatOptions
} from './diagnostics.js';
import {
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReportIfRequested,
  evaluateAnchorAlignment,
  formatAnchorAlignmentReport,
  formatAnchorValidationReport
} from './diagnostics.js';

export type PreparedAnnotationLayoutOptions = Omit<LayoutOptions, 'annotations' | 'obstacles'> & {
  additionalObstacles?: Box[];
  assertValidation?: AnchorValidationAssertInput;
  assertQuality?: boolean | LayoutQualityAssertOptions;
  assertTargetAlignment?: AnchorAlignmentAssertInput;
  includePreparedObstacles?: boolean;
  validationFormat?: AnchorValidationFormatOptions;
  qualityFormat?: LayoutQualityFormatOptions;
  targetAlignmentTargets?: AnchorAlignmentTarget[];
  targetAlignmentOptions?: AnchorAlignmentOptions;
  targetAlignmentFormat?: AnchorAlignmentFormatOptions;
};

export type PreparedAnnotationLayoutResult<
  TValidation extends AnchorSpecValidationReport = AnchorSpecValidationReport
> = AdapterAnnotationLayerInput<TValidation> & {
  layout: ResolvedLayout;
  quality: LayoutQualityReport;
  validationSummary: string;
  qualitySummary: string;
  targetAlignment?: AnchorAlignmentReport;
  targetAlignmentSummary?: string;
};

export type GeneratedSurfaceLayoutDefaultsOptions = {
  anchorLabel?: string;
  layoutLabel?: string;
  failOnWarnings?: boolean;
  includeInfo?: boolean;
};

export type GeneratedSurfaceLayoutDefaults = {
  padding: PaddingInput;
  placement: PlacementPreference;
  refinement: boolean | LayoutRefinementOptions;
  assertValidation: AnchorValidationAssertOptions;
  assertQuality: LayoutQualityAssertOptions;
  validationFormat: AnchorValidationFormatOptions;
  qualityFormat: LayoutQualityFormatOptions;
  targetAlignmentFormat: AnchorAlignmentFormatOptions;
};

export function generatedSurfaceLayoutDefaults(
  options: GeneratedSurfaceLayoutDefaultsOptions = {}
): GeneratedSurfaceLayoutDefaults {
  const anchorLabel = options.anchorLabel ?? 'Generated anchors';
  const layoutLabel = options.layoutLabel ?? 'Generated annotations';

  return {
    padding: 12,
    placement: {
      side: ['right', 'bottom', 'top', 'left'],
      align: ['center', 'start', 'end'],
      offset: [16, 28],
      crossOffset: [0, -32, 32]
    },
    refinement: { passes: 2, maxCandidatesPerAnnotation: 32 },
    assertValidation: {
      label: anchorLabel,
      ...(options.failOnWarnings === undefined ? {} : { failOnWarnings: options.failOnWarnings })
    },
    assertQuality: { label: layoutLabel },
    validationFormat: { label: anchorLabel },
    qualityFormat: {
      label: layoutLabel,
      ...(options.includeInfo === undefined ? {} : { includeInfo: options.includeInfo })
    },
    targetAlignmentFormat: {
      label: `${anchorLabel} target alignment`,
      ...(options.includeInfo === undefined ? {} : { includeAligned: options.includeInfo })
    }
  };
}

export function resolvePreparedAnnotationLayout<
  TValidation extends AnchorSpecValidationReport
>(
  prepared: AdapterAnnotationLayerInput<TValidation>,
  options: PreparedAnnotationLayoutOptions
): PreparedAnnotationLayoutResult<TValidation> {
  assertAnchorValidationReportIfRequested(prepared.validation, options.assertValidation);

  const obstacles = [
    ...(options.includePreparedObstacles === false ? [] : prepared.obstacles),
    ...(options.additionalObstacles ?? [])
  ];
  const layout = resolveAnnotationLayout({
    annotations: prepared.annotations,
    bounds: options.bounds,
    obstacles,
    ...(options.padding !== undefined ? { padding: options.padding } : {}),
    ...(options.noteSizes ? { noteSizes: options.noteSizes } : {}),
    ...(options.defaultNoteSize ? { defaultNoteSize: options.defaultNoteSize } : {}),
    ...(options.placement ? { placement: options.placement } : {}),
    ...(options.refinement !== undefined ? { refinement: options.refinement } : {})
  });
  const quality = evaluateAnnotationLayout(layout);

  if (options.assertQuality) {
    assertAnnotationLayoutQuality(
      quality,
      options.assertQuality === true ? {} : options.assertQuality
    );
  }
  const targetAlignment = targetAlignmentReport(prepared.annotations, options);

  if (options.assertTargetAlignment) {
    assertAnchorAlignmentReportIfRequested(
      targetAlignment!,
      options.assertTargetAlignment
    );
  }

  return {
    ...prepared,
    obstacles,
    layout,
    quality,
    validationSummary: formatAnchorValidationReport(prepared.validation, options.validationFormat),
    qualitySummary: formatLayoutQualityReport(quality, options.qualityFormat),
    ...(targetAlignment ? {
      targetAlignment,
      targetAlignmentSummary: formatAnchorAlignmentReport(targetAlignment, options.targetAlignmentFormat)
    } : {})
  };
}

function targetAlignmentReport(
  annotations: AdapterAnnotationLayerInput['annotations'],
  options: PreparedAnnotationLayoutOptions
): AnchorAlignmentReport | undefined {
  const targets = options.targetAlignmentTargets;

  if (!targets || targets.length === 0) {
    if (options.assertTargetAlignment) {
      throw new Error('targetAlignmentTargets are required when assertTargetAlignment is set.');
    }

    return undefined;
  }

  return evaluateAnchorAlignment(
    annotations,
    targets,
    options.targetAlignmentOptions
  );
}
