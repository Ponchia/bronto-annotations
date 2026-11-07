import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  anchorPoint, renderAnnotationsSvg, resolveAnnotationLayout,
  type Anchor, type LayoutOptions, type Point
} from '../../src/index.js';
import {
  anchorsFromD2Diagram, prepareD2DiagramAnnotations, validateD2DiagramAnchors,
  type D2DiagramLike
} from '../../src/adapters/d2.js';

const coordinate = fc.integer({ min: -1000, max: 1000 });
const point = fc.record({ x: coordinate, y: coordinate });
const path = fc.array(point, { minLength: 1, maxLength: 16 });
const length = fc.integer({ min: 0, max: 1000 });
const spec = [{ id: 'route-note', connectionId: 'route' }];
const diagram = (route: Point[]): D2DiagramLike => ({
  connections: [{ id: 'route', src: 'a', dst: 'b', route }]
});

function near(actual: Point, expected: Point) {
  assert.ok(Number.isFinite(actual.x) && Number.isFinite(actual.y));
  assert.ok(Math.abs(actual.x - expected.x) < 1e-7, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-7, `y: ${actual.y} != ${expected.y}`);
}

// An analytic L-shaped route gives an oracle independent of the core traversal.
export function midpointProperty(extract = anchorsFromD2Diagram) {
  return fc.property(point, length, length, (origin, horizontal, vertical) => {
    const route = [origin, { x: origin.x + horizontal, y: origin.y },
      { x: origin.x + horizontal, y: origin.y + vertical }];
    const halfway = (horizontal + vertical) / 2;
    const expected = {
      x: origin.x + Math.min(horizontal, halfway),
      y: origin.y + Math.max(0, halfway - horizontal)
    };
    const extracted = extract(diagram(route), spec);
    assert.equal(extracted.length, 1);
    near(extracted[0]!.point, expected);
    near(anchorPoint(extracted[0]!.anchor), expected);
  });
}

export function translationProperty(resolve = anchorPoint) {
  return fc.property(path, point, (points, delta) => {
    const before = structuredClone(points);
    const translated = points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }));
    const initial = resolve({ type: 'path', points });
    near(resolve({ type: 'path', points: translated }), {
      x: initial.x + delta.x, y: initial.y + delta.y
    });
    assert.deepEqual(structuredClone(points), before);
  });
}

export function repeatedSegmentsProperty(resolve = anchorPoint) {
  return fc.property(path, fc.integer({ min: 2, max: 5 }), (points, repeats) => {
    near(resolve({ type: 'path', points: points.flatMap(p => Array.from({ length: repeats }, () => ({ ...p }))) }),
      resolve({ type: 'path', points }));
    const first = points[0]!;
    near(resolve({ type: 'path', points: Array.from({ length: repeats }, () => ({ ...first })) }), first);
    near(resolve({ type: 'path', points: [] }), { x: 0, y: 0 });
  });
}

export function invalidCoordinatesProperty(validate = validateD2DiagramAnchors) {
  return fc.property(path, fc.nat(), fc.constantFrom('x' as const, 'y' as const),
    fc.constantFrom(NaN, Infinity, -Infinity), (points, index, field, value) => {
      // Validate the uncorrupted route too: unconditional rejection must fail.
      assert.equal(validate(diagram(points), spec).ok, true);
      const corrupted = structuredClone(points);
      corrupted[index % points.length]![field] = value;
      const input = diagram(corrupted);
      const report = validate(input, spec);
      assert.equal(report.ok, false);
      assert.deepEqual(report.found, []);
      assert.equal(report.diagnostics[0]?.status, 'invalid');
      assert.throws(() => prepareD2DiagramAnnotations(input, spec, { assert: true, obstacles: false }), /finite/i);
      // Permissive extraction remains the documented API, even for bad inputs.
      assert.equal(anchorsFromD2Diagram(input, spec).length, 1);
    });
}

const anchor: fc.Arbitrary<Anchor> = fc.oneof(
  point.map(p => ({ type: 'point' as const, point: p })),
  fc.record({ x: coordinate, y: coordinate, width: length, height: length })
    .map(box => ({ type: 'box' as const, box })),
  path.map(points => ({ type: 'path' as const, points }))
);
const scene: fc.Arbitrary<LayoutOptions> = fc.record({
  anchors: fc.array(anchor, { minLength: 1, maxLength: 4 }),
  obstacles: fc.array(fc.record({ x: coordinate, y: coordinate, width: length, height: length }), { maxLength: 3 }),
  width: fc.integer({ min: 1, max: 800 }),
  height: fc.integer({ min: 1, max: 600 }),
  noteWidth: fc.integer({ min: 1, max: 180 }),
  noteHeight: fc.integer({ min: 1, max: 100 })
}).map(({ anchors, obstacles, width, height, noteWidth, noteHeight }) => ({
  annotations: anchors.map((a, i) => ({ id: `note-${i}`, anchor: a, note: { title: `Note ${i}` } })),
  bounds: { x: 0, y: 0, width, height }, obstacles,
  defaultNoteSize: { width: noteWidth, height: noteHeight },
  // Center alignment retains all four sides with 80 candidates per note.
  placement: { allowedAligns: ['center'], offset: [12, 32], crossOffset: [0] }
}));

function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
}

function finiteDeep(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `nonfinite output: ${value}`);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteDeep);
}

export function layoutProperty(resolve = resolveAnnotationLayout) {
  return fc.property(scene, input => {
    const before = structuredClone(input);
    freezeDeep(input);
    const first = resolve(input);
    // structuredClone normalizes prototypes: fast-check also emits records
    // with a null prototype, which are valid input geometry.
    assert.deepEqual(structuredClone(resolve(structuredClone(before))), structuredClone(first));
    assert.deepEqual(structuredClone(input), before);
    assert.deepEqual(first.annotations.map(a => a.id).sort(), input.annotations.map(a => a.id).sort());
    finiteDeep(first);
    for (const annotation of first.annotations) {
      assert.ok(annotation.noteBox.width >= 0 && annotation.noteBox.height >= 0);
      near(annotation.anchorPoint, anchorPoint(annotation.annotation.anchor, annotation.placement.side));
      assert.doesNotMatch(annotation.connector.d, /NaN|Infinity/);
    }
  });
}

// XML 1.0 characters, including astral Unicode; raw control/surrogate handling
// is outside the escaping contract. Every case also contains markup and quotes.
const xmlText = fc.array(fc.oneof(
  fc.integer({ min: 0x20, max: 0xd7ff }),
  fc.integer({ min: 0xe000, max: 0xfffd }),
  fc.integer({ min: 0x10000, max: 0x10ffff })
), { maxLength: 32 }).map(points => `${String.fromCodePoint(...points)}<tag data-x="&">'`);

export function serializationProperty(render = renderAnnotationsSvg) {
  return fc.property(xmlText, text => {
    const layout = resolveAnnotationLayout({
      annotations: [{ id: text, anchor: { type: 'point', point: { x: 80, y: 80 } },
        note: { title: 'Note', ariaLabel: text, data: { payload: text } } }],
      bounds: { x: 0, y: 0, width: 400, height: 300 }
    });
    const svg = render(layout, { title: text, ariaLabel: text });
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    assert.equal(document.querySelector('parsererror'), null);
    assert.equal(document.querySelector('svg > title')?.textContent, text);
    assert.equal(document.documentElement.getAttribute('aria-label'), text);
    const notes = document.querySelectorAll('[data-payload]');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.getAttribute('data-payload'), text);
    assert.equal(notes[0]!.getAttribute('aria-label'), text);
    assert.equal(notes[0]!.getAttribute('data-annotation-id'), text);
    assert.equal(document.querySelector('tag'), null);
  });
}
