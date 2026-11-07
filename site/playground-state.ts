/** Public demo state only: no application data, persistence or package API. */
export type PlaygroundState = Readonly<{
  notes: number;
  obstacle: number;
  routing: 'orthogonal' | 'none';
  placement: 'automatic' | 'fixed';
}>;

export const DEFAULT_PLAYGROUND_STATE: PlaygroundState = Object.freeze({
  notes: 3,
  obstacle: 150,
  routing: 'orthogonal',
  placement: 'automatic',
});

export type SceneHashResult =
  | { kind: 'unrelated' }
  | { kind: 'invalid' }
  | { kind: 'scene'; state: PlaygroundState };

const prefix = '#playground?';
const fields = ['v', 'notes', 'obstacle', 'routing', 'placement'] as const;

function validState(state: PlaygroundState): boolean {
  return Number.isInteger(state.notes) && state.notes >= 2 && state.notes <= 5
    && Number.isInteger(state.obstacle) && state.obstacle >= 80 && state.obstacle <= 215
    && state.obstacle % 5 === 0
    && (state.routing === 'orthogonal' || state.routing === 'none')
    && (state.placement === 'automatic' || state.placement === 'fixed');
}

/** Unknown, duplicated or out-of-range settings reject the whole scene. */
export function parseSceneHash(hash: string): SceneHashResult {
  if (!hash.startsWith(prefix)) return { kind: 'unrelated' };
  if (hash.length > 256) return { kind: 'invalid' };
  const parameters = new URLSearchParams(hash.slice(prefix.length));
  if (parameters.size !== fields.length
    || fields.some((field) => parameters.getAll(field).length !== 1)
    || parameters.get('v') !== '1') return { kind: 'invalid' };
  const notes = parameters.get('notes') ?? '';
  const obstacle = parameters.get('obstacle') ?? '';
  const routing = parameters.get('routing');
  const placement = parameters.get('placement');
  if (!/^[2-5]$/.test(notes) || !/^\d{2,3}$/.test(obstacle)
    || (routing !== 'orthogonal' && routing !== 'none')
    || (placement !== 'automatic' && placement !== 'fixed')) return { kind: 'invalid' };
  const state: PlaygroundState = { notes: Number(notes), obstacle: Number(obstacle), routing, placement };
  return validState(state) ? { kind: 'scene', state } : { kind: 'invalid' };
}

/** A versioned fragment restores only the four bounded demonstration controls. */
export function sceneHash(state: PlaygroundState): string {
  if (!validState(state)) throw new RangeError('Invalid playground settings');
  const parameters = new URLSearchParams({
    v: '1',
    notes: String(state.notes),
    obstacle: String(state.obstacle),
    routing: state.routing,
    placement: state.placement,
  });
  return prefix + parameters.toString();
}

export function sceneUrl(pageUrl: string, state: PlaygroundState): string {
  const url = new URL(pageUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('A scene link needs an HTTP(S) page');
  }
  // Do not propagate arbitrary query strings, credentials or unrelated fragments.
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = sceneHash(state);
  return url.href;
}
