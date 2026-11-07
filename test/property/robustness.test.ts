// @vitest-environment jsdom
import fc from 'fast-check';
import { describe, it } from 'vitest';
import {
  invalidCoordinatesProperty, layoutProperty, midpointProperty,
  repeatedSegmentsProperty, serializationProperty, translationProperty
} from './properties.js';

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const text = process.env[name];
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!/^-?\d+$/.test(text) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

const seed = integerEnv('FC_SEED', 20261107, -2147483648, 2147483647);
const numRuns = integerEnv('FC_RUNS', 500, 1, 10000);
const path = process.env.FC_PATH;
const properties = {
  'path midpoint follows half the route length': midpointProperty(),
  'path midpoint is translation invariant': translationProperty(),
  'zero and repeated segments preserve the midpoint': repeatedSegmentsProperty(),
  'D2 validation rejects corrupted numeric coordinates': invalidCoordinatesProperty(),
  'bounded layout is deterministic, finite and does not mutate input': layoutProperty(),
  'SVG text and attributes round-trip Unicode without markup injection': serializationProperty()
};
const selected = process.env.FC_PROPERTY;
if (selected !== undefined && !Object.hasOwn(properties, selected)) throw new Error(`Unknown FC_PROPERTY: ${selected}`);
if (path !== undefined && selected === undefined) throw new Error('FC_PATH requires an exact FC_PROPERTY');

describe('bounded property robustness', () => {
  for (const [name, property] of Object.entries(properties)) {
    if (selected !== undefined && selected !== name) continue;
    it(`${name} (seed=${seed}, runs=${numRuns})`, () => {
      fc.assert<unknown[]>(property, { seed, numRuns, ...(path === undefined ? {} : { path }), verbose: true });
    }, 30000 * Math.ceil(numRuns / 500));
  }
});
