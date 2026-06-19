import { anchorSubject, overlapArea } from './anchors.js';
import { connectorPath } from './connectors.js';
import {
  DEFAULT_PLACEMENT,
  DEFAULT_SIDES
} from './model.js';
import type {
  Annotation,
  Box,
  ManualPlacement,
  PlacementAlign,
  PlacementCandidate,
  PlacementPreference,
  PlacementSide,
  Size
} from './model.js';

type CandidateInput = {
  annotation: Annotation;
  bounds: Box;
  noteSize: Size;
  obstacles: Box[];
  placedNotes: Box[];
  placement?: PlacementPreference;
  side: PlacementSide;
  sideIndex: number;
  align?: PlacementAlign;
  alignIndex?: number;
  offset?: number;
  offsetIndex?: number;
  crossOffset?: number;
  crossOffsetIndex?: number;
};

export function getCandidateSides(preference?: PlacementPreference): PlacementSide[] {
  const allowed = uniqueSides(preference?.allowedSides?.length ? preference.allowedSides : DEFAULT_SIDES);
  const preferred = uniqueSides(asSides(preference?.side).filter((side) => allowed.includes(side)));
  const rest = allowed.filter((side) => !preferred.includes(side));

  return [...preferred, ...rest];
}

export function candidateNoteBox(
  subjectBox: Box,
  anchorPoint: { x: number; y: number },
  noteSize: Size,
  side: PlacementSide,
  preference?: PlacementPreference,
  candidate: {
    align?: PlacementAlign;
    offset?: number;
    crossOffset?: number;
  } = {}
): Box {
  const align = candidate.align ?? firstAlign(preference?.align) ?? DEFAULT_PLACEMENT.align;
  const offset = candidate.offset ?? firstNumber(preference?.offset) ?? DEFAULT_PLACEMENT.offset;
  const crossOffset = candidate.crossOffset ?? 0;

  switch (side) {
    case 'top':
      return {
        x: alignedX(subjectBox, anchorPoint.x, noteSize.width, align) + crossOffset,
        y: subjectBox.y - noteSize.height - offset,
        width: noteSize.width,
        height: noteSize.height
      };
    case 'right':
      return {
        x: subjectBox.x + subjectBox.width + offset,
        y: alignedY(subjectBox, anchorPoint.y, noteSize.height, align) + crossOffset,
        width: noteSize.width,
        height: noteSize.height
      };
    case 'bottom':
      return {
        x: alignedX(subjectBox, anchorPoint.x, noteSize.width, align) + crossOffset,
        y: subjectBox.y + subjectBox.height + offset,
        width: noteSize.width,
        height: noteSize.height
      };
    case 'left':
      return {
        x: subjectBox.x - noteSize.width - offset,
        y: alignedY(subjectBox, anchorPoint.y, noteSize.height, align) + crossOffset,
        width: noteSize.width,
        height: noteSize.height
      };
  }
}

export function scorePlacementCandidate(input: CandidateInput): PlacementCandidate {
  const align = input.align ?? firstAlign(input.placement?.align) ?? DEFAULT_PLACEMENT.align;
  const offset = input.offset ?? firstNumber(input.placement?.offset) ?? DEFAULT_PLACEMENT.offset;
  const crossOffset = input.crossOffset ?? 0;
  const subject = anchorSubject(input.annotation.anchor, input.side);
  const rawNoteBox = candidateNoteBox(
    subject.box,
    subject.point,
    input.noteSize,
    input.side,
    input.placement,
    { align, offset, crossOffset }
  );
  const noteBox = fitBoxWithin(rawNoteBox, input.bounds);
  const connector = connectorPath(subject.point, noteBox, input.annotation.connector, {
    obstacles: [...input.obstacles, ...input.placedNotes],
    bounds: input.bounds
  });
  const overflow = overflowArea(rawNoteBox, input.bounds);
  const obstacleOverlap = input.obstacles.reduce((total, obstacle) => total + overlapArea(noteBox, obstacle), 0);
  const placedOverlap = input.placedNotes.reduce((total, placed) => total + overlapArea(noteBox, placed), 0);
  const connectorObstacleHits = connectorObstaclePenalty(connector.points, input.obstacles);
  const breakdown = {
    preferredSide: input.sideIndex * 150,
    overflow: overflow * 8,
    obstacles: obstacleOverlap * 4,
    connectors: connectorObstacleHits * 90,
    annotations: placedOverlap * 6,
    distance: offset * 0.1,
    alignment: (input.alignIndex ?? 0) * 12,
    crossOffset: Math.abs(crossOffset) * 0.2 + (input.crossOffsetIndex ?? 0) * 0.01,
    tieBreak: (tieBreak(input.side) + (input.offsetIndex ?? 0) + (input.crossOffsetIndex ?? 0)) / 1000
  };

  return {
    side: input.side,
    align,
    offset,
    crossOffset,
    noteBox,
    rawNoteBox,
    connector,
    score: Object.values(breakdown).reduce((total, value) => total + value, 0),
    scoreBreakdown: breakdown
  };
}

export function resolvePlacementCandidate(input: Omit<CandidateInput, 'side' | 'sideIndex'>): PlacementCandidate {
  const candidates = allPlacementCandidates(input);

  return candidates[0] ?? scorePlacementCandidate({ ...input, side: 'top', sideIndex: 0 });
}

export function allPlacementCandidates(input: Omit<CandidateInput, 'side' | 'sideIndex'>): PlacementCandidate[] {
  if (input.placement?.manual) {
    return [manualPlacementCandidate(input, input.placement.manual)];
  }

  const candidates = placementSearchSpace(input.placement)
    .map((candidate) => scorePlacementCandidate({ ...input, ...candidate }))
    .sort((a, b) => a.score - b.score || sideSort(a.side) - sideSort(b.side));

  return input.placement?.maxCandidates
    ? candidates.slice(0, input.placement.maxCandidates)
    : candidates;
}

function manualPlacementCandidate(
  input: Omit<CandidateInput, 'side' | 'sideIndex'>,
  manual: ManualPlacement
): PlacementCandidate {
  const subject = anchorSubject(input.annotation.anchor, manual.side);
  const rawNoteBox = {
    x: finiteNumber(manual.x, 'placement.manual.x'),
    y: finiteNumber(manual.y, 'placement.manual.y'),
    width: input.noteSize.width,
    height: input.noteSize.height
  };
  const noteBox = manual.clamp === false ? rawNoteBox : fitBoxWithin(rawNoteBox, input.bounds);
  const side = manual.side ?? inferManualSide(subject.point, noteBox);
  const align = manual.align ?? 'center';
  const offset = manualOffset(subject.box, noteBox, side);
  const crossOffset = manualCrossOffset(subject.box, subject.point, noteBox, side, align);
  const connector = connectorPath(subject.point, noteBox, input.annotation.connector, {
    obstacles: [...input.obstacles, ...input.placedNotes],
    bounds: input.bounds
  });
  const overflow = overflowArea(rawNoteBox, input.bounds);
  const obstacleOverlap = input.obstacles.reduce((total, obstacle) => total + overlapArea(noteBox, obstacle), 0);
  const placedOverlap = input.placedNotes.reduce((total, placed) => total + overlapArea(noteBox, placed), 0);
  const connectorObstacleHits = connectorObstaclePenalty(connector.points, input.obstacles);
  const breakdown = {
    preferredSide: 0,
    overflow: overflow * 8,
    obstacles: obstacleOverlap * 4,
    connectors: connectorObstacleHits * 90,
    annotations: placedOverlap * 6,
    distance: offset * 0.1,
    alignment: 0,
    crossOffset: Math.abs(crossOffset) * 0.2,
    tieBreak: 0
  };

  return {
    side,
    align,
    offset,
    crossOffset,
    noteBox,
    rawNoteBox,
    connector,
    score: Object.values(breakdown).reduce((total, value) => total + value, 0),
    scoreBreakdown: breakdown
  };
}

function asSides(side?: PlacementSide | PlacementSide[]): PlacementSide[] {
  if (!side) {
    return [];
  }

  return Array.isArray(side) ? side : [side];
}

function asAligns(align?: PlacementAlign | PlacementAlign[]): PlacementAlign[] {
  if (!align) {
    return [];
  }

  return Array.isArray(align) ? align : [align];
}

function asNumbers(value?: number | number[]): number[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function uniqueSides(sides: PlacementSide[]): PlacementSide[] {
  return sides.filter((side, index) => sides.indexOf(side) === index);
}

function uniqueAligns(aligns: PlacementAlign[]): PlacementAlign[] {
  return aligns.filter((align, index) => aligns.indexOf(align) === index);
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index) => Number.isFinite(value) && values.indexOf(value) === index);
}

function getCandidateAligns(preference?: PlacementPreference): PlacementAlign[] {
  const defaults: PlacementAlign[] = ['center', 'start', 'end'];
  const allowed = uniqueAligns(preference?.allowedAligns?.length ? preference.allowedAligns : defaults);
  const preferred = uniqueAligns(asAligns(preference?.align).filter((align) => allowed.includes(align)));
  const rest = allowed.filter((align) => !preferred.includes(align));

  return [...preferred, ...rest];
}

function getCandidateOffsets(preference?: PlacementPreference): number[] {
  const preferred = uniqueNumbers(asNumbers(preference?.offset));
  const base = preferred[0] ?? DEFAULT_PLACEMENT.offset;
  const defaults = uniqueNumbers([base, base + 8, base + 20, Math.max(4, base - 6)]);
  const rest = defaults.filter((offset) => !preferred.includes(offset));

  return [...preferred, ...rest];
}

function getCandidateCrossOffsets(preference?: PlacementPreference): number[] {
  const preferred = uniqueNumbers(asNumbers(preference?.crossOffset));
  const defaults = [0, -32, 32, -64, 64];
  const rest = defaults.filter((offset) => !preferred.includes(offset));

  return [...preferred, ...rest];
}

function placementSearchSpace(preference?: PlacementPreference): Array<{
  side: PlacementSide;
  sideIndex: number;
  align: PlacementAlign;
  alignIndex: number;
  offset: number;
  offsetIndex: number;
  crossOffset: number;
  crossOffsetIndex: number;
}> {
  const candidates = [];

  for (const [sideIndex, side] of getCandidateSides(preference).entries()) {
    for (const [alignIndex, align] of getCandidateAligns(preference).entries()) {
      for (const [offsetIndex, offset] of getCandidateOffsets(preference).entries()) {
        for (const [crossOffsetIndex, crossOffset] of getCandidateCrossOffsets(preference).entries()) {
          candidates.push({
            side,
            sideIndex,
            align,
            alignIndex,
            offset,
            offsetIndex,
            crossOffset,
            crossOffsetIndex
          });
        }
      }
    }
  }

  return candidates;
}

function firstAlign(value?: PlacementAlign | PlacementAlign[]): PlacementAlign | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function firstNumber(value?: number | number[]): number | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function alignedX(box: Box, anchorX: number, width: number, align: PlacementAlign): number {
  switch (align) {
    case 'start':
      return box.x;
    case 'end':
      return box.x + box.width - width;
    case 'center':
    default:
      return anchorX - width / 2;
  }
}

function alignedY(box: Box, anchorY: number, height: number, align: PlacementAlign): number {
  switch (align) {
    case 'start':
      return box.y;
    case 'end':
      return box.y + box.height - height;
    case 'center':
    default:
      return anchorY - height / 2;
  }
}

function fitBoxWithin(box: Box, bounds: Box): Box {
  if (box.width > bounds.width || box.height > bounds.height) {
    return box;
  }

  return {
    ...box,
    x: clamp(box.x, bounds.x, bounds.x + bounds.width - box.width),
    y: clamp(box.y, bounds.y, bounds.y + bounds.height - box.height)
  };
}

function overflowArea(box: Box, bounds: Box): number {
  const outsideLeft = Math.max(0, bounds.x - box.x);
  const outsideTop = Math.max(0, bounds.y - box.y);
  const outsideRight = Math.max(0, box.x + box.width - (bounds.x + bounds.width));
  const outsideBottom = Math.max(0, box.y + box.height - (bounds.y + bounds.height));

  return (outsideLeft + outsideRight) * box.height + (outsideTop + outsideBottom) * box.width;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }

  return value;
}

function inferManualSide(anchorPoint: { x: number; y: number }, noteBox: Box): PlacementSide {
  const noteCenter = {
    x: noteBox.x + noteBox.width / 2,
    y: noteBox.y + noteBox.height / 2
  };
  const dx = noteCenter.x - anchorPoint.x;
  const dy = noteCenter.y - anchorPoint.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
}

function manualOffset(subjectBox: Box, noteBox: Box, side: PlacementSide): number {
  switch (side) {
    case 'top':
      return Math.max(0, subjectBox.y - (noteBox.y + noteBox.height));
    case 'right':
      return Math.max(0, noteBox.x - (subjectBox.x + subjectBox.width));
    case 'bottom':
      return Math.max(0, noteBox.y - (subjectBox.y + subjectBox.height));
    case 'left':
      return Math.max(0, subjectBox.x - (noteBox.x + noteBox.width));
  }
}

function manualCrossOffset(
  subjectBox: Box,
  anchorPoint: { x: number; y: number },
  noteBox: Box,
  side: PlacementSide,
  align: PlacementAlign
): number {
  const defaultBox = candidateNoteBox(subjectBox, anchorPoint, noteBox, side, undefined, {
    align,
    offset: manualOffset(subjectBox, noteBox, side),
    crossOffset: 0
  });

  return side === 'top' || side === 'bottom'
    ? noteBox.x - defaultBox.x
    : noteBox.y - defaultBox.y;
}

function sideSort(side: PlacementSide): number {
  return DEFAULT_SIDES.indexOf(side);
}

function tieBreak(side: PlacementSide): number {
  return sideSort(side) + 1;
}

function connectorObstaclePenalty(points: Array<{ x: number; y: number }>, obstacles: Box[]): number {
  if (points.length < 2 || obstacles.length === 0) {
    return 0;
  }

  let hits = 0;

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1]!;
    const end = points[pointIndex]!;

    for (const obstacle of obstacles) {
      if (segmentIntersectsBox(start, end, obstacle)) {
        hits += 1;
      }
    }
  }

  return hits;
}

function segmentIntersectsBox(start: { x: number; y: number }, end: { x: number; y: number }, box: Box): boolean {
  if (pointInsideBox(start, box) || pointInsideBox(end, box)) {
    return true;
  }

  const topLeft = { x: box.x, y: box.y };
  const topRight = { x: box.x + box.width, y: box.y };
  const bottomRight = { x: box.x + box.width, y: box.y + box.height };
  const bottomLeft = { x: box.x, y: box.y + box.height };

  return segmentsIntersect(start, end, topLeft, topRight)
    || segmentsIntersect(start, end, topRight, bottomRight)
    || segmentsIntersect(start, end, bottomRight, bottomLeft)
    || segmentsIntersect(start, end, bottomLeft, topLeft);
}

function pointInsideBox(point: { x: number; y: number }, box: Box): boolean {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height;
}

function segmentsIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  return abC * abD <= 0 && cdA * cdB <= 0;
}

function orientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}
