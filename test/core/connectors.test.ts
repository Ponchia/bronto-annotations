import { describe, expect, it } from 'vitest';
import { connectorPath, connectorPathD, nearestPointOnBox } from '../../src/index.js';

describe('connector helpers', () => {
  it('chooses the nearest note edge point', () => {
    expect(nearestPointOnBox(
      { x: 10, y: 50 },
      { x: 100, y: 20, width: 80, height: 60 }
    )).toEqual({ x: 100, y: 50 });
  });

  it('returns deterministic SVG path data', () => {
    expect(connectorPathD(
      { x: 10, y: 50 },
      { x: 100, y: 20, width: 80, height: 60 }
    )).toBe('M 10 50 L 100 50');
  });

  it('keeps connector point data for non-SVG renderers', () => {
    expect(connectorPath(
      { x: 50, y: 10 },
      { x: 20, y: 100, width: 60, height: 40 }
    )).toMatchObject({
      type: 'elbow',
      points: [
      { x: 50, y: 10 },
      { x: 50, y: 100 }
      ]
    });
  });

  it('supports straight, curved, and disabled connectors', () => {
    expect(connectorPathD(
      { x: 10, y: 20 },
      { x: 80, y: 10, width: 40, height: 30 },
      { type: 'straight' }
    )).toBe('M 10 20 L 80 20');
    expect(connectorPathD(
      { x: 10, y: 20 },
      { x: 80, y: 10, width: 40, height: 30 },
      { type: 'curve' }
    )).toContain('C');
    expect(connectorPathD(
      { x: 10, y: 20 },
      { x: 80, y: 10, width: 40, height: 30 },
      { type: 'none' }
    )).toBe('');
  });

  it('supports start and end offsets without crossing endpoints', () => {
    expect(connectorPath(
      { x: 0, y: 0 },
      { x: 100, y: -10, width: 40, height: 20 },
      { type: 'straight', startOffset: 10, endOffset: 20 }
    )).toMatchObject({
      points: [
        { x: 10, y: 0 },
        { x: 80, y: 0 }
      ],
      d: 'M 10 0 L 80 0'
    });
    expect(connectorPathD(
      { x: 0, y: 0 },
      { x: 20, y: -10, width: 20, height: 20 },
      { type: 'straight', startOffset: 80, endOffset: 80 }
    )).toBe('M 10 0 L 10 0');
  });

  it('routes connectors through manual waypoints', () => {
    expect(connectorPath(
      { x: 0, y: 0 },
      { x: 100, y: -10, width: 20, height: 20 },
      {
        type: 'straight',
        points: [
          { x: 0, y: -30 },
          { x: 100, y: -30 }
        ]
      }
    )).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 0, y: -30 },
        { x: 100, y: -30 },
        { x: 100, y: 0 }
      ],
      d: 'M 0 0 L 0 -30 L 100 -30 L 100 0'
    });
    expect(connectorPathD(
      { x: 10, y: 10 },
      { x: 100, y: 0, width: 20, height: 20 },
      {
        type: 'straight',
        pointMode: 'relative',
        points: [
          { x: 20, y: -30 },
          { x: 70, y: -30 }
        ]
      }
    )).toBe('M 10 10 L 30 -20 L 80 -20 L 100 10');
  });

  it('uses connector waypoints as curve controls', () => {
    expect(connectorPathD(
      { x: 0, y: 0 },
      { x: 100, y: -10, width: 20, height: 20 },
      {
        type: 'curve',
        points: [
          { x: 20, y: -40 },
          { x: 80, y: -40 }
        ]
      }
    )).toBe('M 0 0 C 20 -40 80 -40 100 0');
  });

  it('can route straight connectors around rectangular obstacles', () => {
    const connector = connectorPath(
      { x: 0, y: 50 },
      { x: 100, y: 40, width: 40, height: 20 },
      { type: 'straight' },
      {
        bounds: { x: -20, y: 0, width: 180, height: 120 },
        obstacles: [
          { x: 40, y: 40, width: 20, height: 20 }
        ]
      }
    );

    expect(connector.points).toEqual([
      { x: 0, y: 50 },
      { x: 0, y: 33 },
      { x: 67, y: 33 },
      { x: 67, y: 50 },
      { x: 100, y: 50 }
    ]);
    expect(connector.d).toBe('M 0 50 L 0 33 L 67 33 L 67 50 L 100 50');
  });

  it('honors routing none when obstacle detours are disabled', () => {
    expect(connectorPathD(
      { x: 0, y: 50 },
      { x: 100, y: 40, width: 40, height: 20 },
      { type: 'straight', routing: 'none' },
      {
        bounds: { x: -20, y: 0, width: 180, height: 120 },
        obstacles: [
          { x: 40, y: 40, width: 20, height: 20 }
        ]
      }
    )).toBe('M 0 50 L 100 50');
  });
});
