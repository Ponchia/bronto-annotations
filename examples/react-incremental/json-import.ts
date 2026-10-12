/**
 * Host-side JSON input guard for this small interactive demonstration.
 *
 * Not a library codec or package export. This editor deliberately supports a
 * small serializable subset of Annotation: point/box anchors, note text, and
 * optional placement settings. Reject unfamiliar fields rather than silently
 * dropping data. A production host should validate its own complete schema.
 */
import type { Annotation, AnnotationNote, PlacementPreference } from '@ponchia/annotations';

const MAX_LENGTH = 24_000;
export const EDITOR_MAX_NOTES = 10;
export const EDITOR_TITLE_MAX_LENGTH = 100;
export const EDITOR_BODY_MAX_LENGTH = 400;
const SIDE = ['top', 'right', 'bottom', 'left'] as const;
const ALIGN = ['start', 'center', 'end'] as const;

function fail(message: string): never {
  throw new Error(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function allowed(value: Record<string, unknown>, names: readonly string[], label: string): void {
  const unknown = Object.keys(value).find((key) => !names.includes(key));
  if (unknown) fail(`${label} contains unsupported field "${unknown}". This example imports only notes, point/box anchors and placement settings.`);
}

function number(value: unknown, label: string, minimum = -2_000, maximum = 2_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || value < minimum || value > maximum) {
    return fail(`${label} must be a finite number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function string(value: unknown, label: string, max = 400): string {
  if (typeof value !== 'string' || value.length > max) {
    return fail(`${label} must be text of at most ${max} characters.`);
  }
  return value;
}

function choice<const T extends readonly string[]>(
  value: unknown, choices: T, label: string
): T[number] {
  return choices.includes(value as T[number])
    ? value as T[number]
    : fail(`${label} must be one of: ${choices.join(', ')}.`);
}

function optional<T>(
  value: unknown, label: string, validator: (value: unknown, label: string) => T
): T | undefined {
  return value === undefined ? undefined : validator(value, label);
}

function coordinates(data: Record<string, unknown>, label: string) {
  return { x: number(data.x, `${label}.x`), y: number(data.y, `${label}.y`) };
}

function point(value: unknown, label: string) {
  const data = object(value, label);
  allowed(data, ['x', 'y'], label);
  return coordinates(data, label);
}

function anchor(value: unknown, label: string): Annotation['anchor'] {
  const data = object(value, label);
  switch (data.type) {
    case 'point':
      allowed(data, ['type', 'point'], label);
      return { type: 'point', point: point(data.point, `${label}.point`) };
    case 'box': {
      allowed(data, ['type', 'box', 'side'], label);
      const box = object(data.box, `${label}.box`);
      allowed(box, ['x', 'y', 'width', 'height'], `${label}.box`);
      const side = optional(data.side, `${label}.side`, (v, k) => choice(v, SIDE, k));
      return {
        type: 'box',
        box: {
          ...coordinates(box, `${label}.box`),
          width: number(box.width, `${label}.box.width`, 0, 2_000),
          height: number(box.height, `${label}.box.height`, 0, 2_000)
        },
        ...(side === undefined ? {} : { side })
      };
    }
    default:
      return fail(`${label}.type must be "point" or "box" in this example.`);
  }
}

function note(value: unknown, label: string): AnnotationNote {
  const data = object(value, label);
  allowed(data, ['title', 'body', 'ariaLabel', 'align', 'visible'], label);
  const title = optional(data.title, `${label}.title`, (v, k) => string(v, k, EDITOR_TITLE_MAX_LENGTH));
  const body = optional(data.body, `${label}.body`, (v, k) => string(v, k, EDITOR_BODY_MAX_LENGTH));
  const ariaLabel = optional(data.ariaLabel, `${label}.ariaLabel`, (v, k) => string(v, k, 120));
  const align = optional(data.align, `${label}.align`, (v, k) => choice(v, ALIGN, k));
  if (!title?.trim() && !body?.trim()) fail(`${label} needs a title or body.`);
  if (data.visible !== undefined && typeof data.visible !== 'boolean') {
    fail(`${label}.visible must be true or false.`);
  }
  return {
    ...(title === undefined ? {} : { title }),
    ...(body === undefined ? {} : { body }),
    ...(ariaLabel === undefined ? {} : { ariaLabel }),
    ...(align === undefined ? {} : { align }),
    ...(data.visible === undefined ? {} : { visible: data.visible as boolean })
  };
}

function placement(value: unknown, label: string): PlacementPreference {
  const data = object(value, label);
  allowed(data, ['manual', 'side', 'align', 'offset', 'crossOffset'], label);
  const manualData = data.manual === undefined ? undefined : object(data.manual, `${label}.manual`);
  if (manualData) allowed(manualData, ['x', 'y', 'side', 'align', 'clamp'], `${label}.manual`);
  if (manualData && manualData.clamp !== undefined && typeof manualData.clamp !== 'boolean') {
    fail(`${label}.manual.clamp must be true or false.`);
  }
  const manual = manualData && {
    ...coordinates(manualData, `${label}.manual`),
    ...(manualData.side === undefined ? {} :
      { side: choice(manualData.side, SIDE, `${label}.manual.side`) }),
    ...(manualData.align === undefined ? {} :
      { align: choice(manualData.align, ALIGN, `${label}.manual.align`) }),
    ...(manualData.clamp === undefined ? {} : { clamp: manualData.clamp as boolean })
  };
  const side = optional(data.side, `${label}.side`, (v, k) => choice(v, SIDE, k));
  const align = optional(data.align, `${label}.align`, (v, k) => choice(v, ALIGN, k));
  return {
    ...(manual ? { manual } : {}),
    ...(side ? { side } : {}),
    ...(align ? { align } : {}),
    ...(data.offset === undefined ? {} : { offset: number(data.offset, `${label}.offset`, -500, 500) }),
    ...(data.crossOffset === undefined ? {} : { crossOffset: number(data.crossOffset, `${label}.crossOffset`, -500, 500) })
  };
}

export function parseEditorAnnotationJson(raw: string): Annotation[] {
  if (raw.length > MAX_LENGTH) fail(`JSON exceeds the ${MAX_LENGTH.toLocaleString('en-US')}-character demo limit.`);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('Invalid JSON. Paste an array of annotation objects.');
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > EDITOR_MAX_NOTES) {
    return fail(`Expected an array of 1 to ${EDITOR_MAX_NOTES} annotation objects.`);
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const label = `Annotation ${index + 1}`;
    const data = object(entry, label);
    allowed(data, ['id', 'priority', 'anchor', 'note', 'placement'], label);
    // Host annotation IDs are strings, not CSS identifiers. Keep Unicode,
    // spaces and punctuation; exclude empty or control-character IDs.
    if (typeof data.id !== 'string' || !data.id.trim() || data.id.length > 80
      || /[\u0000-\u001f\u007f]/u.test(data.id)) {
      fail(`${label}.id needs 1–80 visible characters, without control characters.`);
    }
    const id = data.id as string;
    if (seen.has(id)) fail(`Duplicate annotation ID "${id}".`);
    seen.add(id);
    const priority = optional(data.priority, `${label}.priority`,
      (v, k) => number(v, k, -100, 100));
    return {
      id,
      ...(priority === undefined ? {} : { priority }),
      anchor: anchor(data.anchor, `${label}.anchor`),
      note: note(data.note, `${label}.note`),
      ...(data.placement === undefined ? {} : {
        placement: placement(data.placement, `${label}.placement`)
      })
    };
  });
}
