import { describe, expect, it } from 'vitest';
import {
  annotationParts,
  annotationTransform,
  axisThresholdPath,
  bandSubjectPath,
  bracketSubjectPath,
  circleSubjectPath,
  comparisonBracePath,
  connectorCurve,
  connectorElbow,
  connectorEndArrow,
  connectorEndDot,
  connectorLine,
  declutterLabels,
  directLabels,
  encircleSubjectPath,
  enclosingCircle,
  evidenceMarkerPath,
  notePlacement,
  noteTransform,
  outlierClusterPath,
  rectSubjectPath,
  slopeSubjectPath,
  subjectPath,
  thresholdPath,
  timelineEventPath
} from '../../src/index.js';

describe('annotation geometry helpers', () => {
  it('formats annotation and note transforms deterministically', () => {
    expect(annotationTransform()).toBe('translate(0, 0)');
    expect(annotationTransform({ x: 12.3456, y: -0 })).toBe('translate(12.346, 0)');
    expect(noteTransform({ dx: 100, dy: 40 })).toBe('translate(100, 40)');
    expect(noteTransform({
      x: 100,
      y: 40,
      align: 'middle',
      valign: 'bottom',
      width: 80,
      height: 20
    })).toBe('translate(60, 20)');
  });

  it('places notes inside bounded surfaces with preferred fallbacks', () => {
    expect(notePlacement({
      x: 40,
      y: 40,
      width: 60,
      height: 30,
      bounds: { x: 0, y: 0, width: 200, height: 120 },
      preferred: 'right',
      gap: 24
    })).toEqual({
      dx: 24,
      dy: 0,
      align: 'start',
      valign: 'middle',
      transform: 'translate(24, -15)'
    });

    expect(notePlacement({
      x: 180,
      y: 100,
      width: 80,
      height: 40,
      bounds: { x: 0, y: 0, width: 220, height: 130 },
      preferred: 'right',
      gap: 24,
      padding: 10
    })).toEqual({
      dx: -24,
      dy: 0,
      align: 'end',
      valign: 'middle',
      transform: 'translate(-104, -20)'
    });
  });

  it('builds subject paths for common annotation shapes', () => {
    expect(circleSubjectPath({ radius: 12.3456 }))
      .toBe('M0,-12.346A12.346,12.346 0 1 1 0,12.346A12.346,12.346 0 1 1 0,-12.346Z');
    expect(rectSubjectPath({ width: 20, height: 10 })).toBe('M-10,-5H10V5H-10Z');
    expect(rectSubjectPath({ width: 20, height: 10, x: 0, y: 0, padding: 2 })).toBe('M-2,-2H22V12H-2Z');
    expect(thresholdPath({ x2: 20, y2: 0 })).toBe('M0,0L20,0');
    expect(axisThresholdPath({ value: 12, start: 0, end: 90 })).toBe('M0,12L90,12');
    expect(axisThresholdPath({ orientation: 'vertical', value: 12, start: 0, end: 90 })).toBe('M12,0L12,90');
    expect(bracketSubjectPath({ x1: 0, y1: 0, x2: 80, y2: 0, depth: 10 })).toBe('M0,0V10H80V0');
    expect(bracketSubjectPath({ x1: 0, y1: 0, x2: 0, y2: 80, depth: 10 })).toBe('M0,0H10V80H0');
    expect(bandSubjectPath({ x: 10, y: 20, width: 40, height: 16, padding: 4 })).toBe('M6,16H54V40H6Z');
    expect(slopeSubjectPath({ x1: 0, y1: 20, x2: 80, y2: 4 })).toBe('M0,20L80,4');
    expect(comparisonBracePath({ x1: 0, y1: 0, x2: 80, y2: 0, depth: 10 }))
      .toBe('M0,0C20,0 20,10 40,10C40,10 40,20 40,20C40,10 60,10 60,0C60,0 60,0 80,0');
    expect(outlierClusterPath({ points: [{ x: 2, y: 3 }, { x: 8, y: 9 }], radius: 2 }))
      .toBe('M2,1A2,2 0 1 1 2,5A2,2 0 1 1 2,1ZM8,7A2,2 0 1 1 8,11A2,2 0 1 1 8,7Z');
    expect(encircleSubjectPath({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 }))
      .toBe('M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z');
    expect(timelineEventPath({ size: 12, direction: 'down' })).toBe('M0,0L6,12H-6Z');
    expect(timelineEventPath({ size: 12, direction: 'left' })).toBe('M0,0L-12,6V-6Z');
    expect(evidenceMarkerPath({ x: 20, y: 20, width: 10, height: 6, padding: 2 })).toBe('M13,15H27V25H13Z');
    expect(subjectPath({ type: 'bracket', x1: 0, y1: 0, x2: 80, y2: 0, depth: 10 })).toBe('M0,0V10H80V0');
    expect(subjectPath({ type: 'encircle', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 }))
      .toBe('M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z');
  });

  it('computes deterministic enclosing circles for host-supplied point sets', () => {
    const circle = enclosingCircle([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 4, y: 6 }
    ]);

    expect(circle.x).toBeCloseTo(4);
    expect(circle.y).toBeCloseTo(1.667, 3);
    expect(circle.radius).toBeCloseTo(4.333, 3);
  });

  it('builds connector paths and end caps, trimming when a subject is present', () => {
    expect(connectorEndDot({ x: 10, y: 20, radius: 4 }))
      .toBe('M10,16A4,4 0 1 1 10,24A4,4 0 1 1 10,16Z');
    expect(connectorEndArrow({ x1: 0, y1: 0, x2: 20, y2: 0, size: 5, spread: 0.4 }))
      .toBe('M20,0L15.395,1.947L15.395,-1.947Z');
    expect(connectorLine({ dx: 30, dy: 40 })).toBe('M0,0L30,40');
    expect(connectorLine({ dx: 30, dy: 40, subject: { type: 'circle', radius: 10 } })).toBe('M6,8L30,40');
    expect(connectorLine({ dx: 30, dy: 40, subject: { type: 'rect', width: 20, height: 10 } })).toBe('M3.75,5L30,40');
    expect(connectorElbow({ dx: 30, dy: 40 })).toBe('M0,0V20H30V40');
    expect(connectorCurve({ dx: 30, dy: 40 })).toBe('M0,0C10.5,0 19.5,40 30,40');
  });

  it('groups subject, connector, note, and transform parts', () => {
    expect(annotationParts({
      x: 10,
      y: 20,
      dx: 60,
      dy: 30,
      type: 'elbow',
      subject: { type: 'circle', radius: 8 }
    })).toEqual({
      transform: 'translate(10, 20)',
      subject: 'M0,-8A8,8 0 1 1 0,8A8,8 0 1 1 0,-8Z',
      connector: 'M7.155,3.578H33.578V30H60',
      note: 'translate(60, 30)'
    });
  });

  it('declutters direct labels along an axis', () => {
    expect(declutterLabels([
      { pos: 10, size: 10 },
      { pos: 12, size: 10 },
      { pos: 40, size: 20 }
    ], { gap: 4, min: 0, max: 60 })).toEqual([10, 24, 43]);

    expect(directLabels([
      { anchor: { x: 10, y: 10 }, size: 10, key: 'a' },
      { anchor: { x: 30, y: 12 }, size: 10, key: 'b' }
    ], { axis: 'y', cross: 80, gap: 4, min: 0, max: 40 })).toEqual([
      { x: 80, y: 10, anchor: { x: 10, y: 10 }, d: 'M10,10L80,10', key: 'a' },
      { x: 80, y: 24, anchor: { x: 30, y: 12 }, d: 'M30,12L80,24', key: 'b' }
    ]);

    expect(directLabels([
      { anchor: { x: 10, y: 10 }, size: 10, key: 'a' },
      { anchor: { x: 12, y: 30 }, size: 10, key: 'b' }
    ], { axis: 'x', cross: 60, gap: 4, min: 0, max: 40, shape: 'curve' })).toEqual([
      { x: 10, y: 60, anchor: { x: 10, y: 10 }, d: 'M10,10C10,10 10,60 10,60', key: 'a' },
      { x: 24, y: 60, anchor: { x: 12, y: 30 }, d: 'M12,30C18,30 18,60 24,60', key: 'b' }
    ]);
  });

  it('rejects invalid numeric inputs early', () => {
    expect(() => circleSubjectPath({ radius: -1 })).toThrow(RangeError);
    expect(() => annotationTransform({ x: Number.NaN, y: 0 })).toThrow(TypeError);
    expect(() => declutterLabels([{ pos: 0, size: 10 }], { min: 20, max: 10 })).toThrow(RangeError);
  });
});
