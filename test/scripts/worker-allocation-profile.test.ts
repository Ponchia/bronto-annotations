import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Private JavaScript verification helper, not a package export.
import { nestedTargetSession, selectOwnedWorker, summarizeAllocationProfile } from '../../scripts/worker-allocation-profile.mjs';

class Root extends EventEmitter { send = async (_method: string, _params: any) => ({}); }
const frame = (id: number, functionName: string, selfSize: number, children: any[] = [], url = '') =>
  ({ id, callFrame: { functionName, url, lineNumber: 1, columnNumber: 2 }, selfSize, children });

describe('Worker isolate allocation evidence', () => {
  it('requires one loopback Worker in the exact owned context', () => {
    const page = { targetId: 'page', browserContextId: 'owned' };
    const target = { type: 'worker', targetId: 'worker', openerId: 'page', browserContextId: 'owned', url: 'http://127.0.0.1:43123/assets/worker.js' };
    expect(selectOwnedWorker([target], page, target.url)).toBe(target);
    for (const values of [[], [target, { ...target }], [{ ...target, browserContextId: 'foreign' }], [{ ...target, openerId: 'other-page' }]])
      expect(() => selectOwnedWorker(values, page, target.url)).toThrow();
    expect(() => selectOwnedWorker([], page, 'https://example.com/worker.js')).toThrow();
    expect(() => selectOwnedWorker([target], { targetId: 'page' }, target.url)).toThrow('identity');
  });
  it('correlates only its own nested responses and frees listeners on close', async () => {
    const root = new Root();
    root.send = async (_method, params) => {
      const { id } = JSON.parse(params.message);
      root.emit('Target.receivedMessageFromTarget', { sessionId: 'foreign', message: JSON.stringify({ id, result: { id: 'wrong' } }) });
      root.emit('Target.receivedMessageFromTarget', { sessionId: 'owned', message: JSON.stringify({ id, result: { id: 'worker-isolate' } }) });
      return {};
    };
    const session = nestedTargetSession(root, 'owned');
    expect(await session.send('Runtime.getIsolateId')).toEqual({ id: 'worker-isolate' });
    session.close(); session.close();
    expect(root.eventNames()).toEqual([]);
    await expect(session.send('Runtime.getIsolateId')).rejects.toThrow('closed');
  });
  it('rejects detach, method failures and timeouts rather than publishing empty success', async () => {
    const root = new Root();
    const session = nestedTargetSession(root, 'owned', 10);
    await expect(session.send('Runtime.getHeapUsage')).rejects.toThrow('timeout');
    const pending = session.send('Runtime.getHeapUsage');
    root.emit('Target.detachedFromTarget', { sessionId: 'owned' });
    await expect(pending).rejects.toThrow('closed');
    expect(root.eventNames()).toEqual([]);
    const failing = new Root(); failing.send = async () => { throw new Error('transport refused'); };
    const failed = nestedTargetSession(failing, 'owned');
    await expect(failed.send('Runtime.getHeapUsage')).rejects.toThrow('transport refused');
    failed.close();
  });
  it('retains unattributed/native evidence and strips URLs/query credentials from frames', () => {
    const profile = { head: frame(1, '(root)', 10, [
      frame(2, 'resolveAnnotationLayout', 30, [frame(3, 'inner', 50, [], 'http://127.0.0.1:1/assets/lib.js?token=secret')]),
      frame(4, 'encodeWorkerLayout', 20, [], 'https://user:secret@host/private?q=secret'),
      frame(5, '(idle)', 40)
    ]), samples: [{ size: 50, nodeId: 3, ordinal: 1 }] };
    const result = summarizeAllocationProfile(profile);
    expect(result.sampledBytes).toBe(150);
    expect(result.totals).toEqual({ layout: 80, 'host-codec': 20, 'other-javascript': 0, 'unattributed-runtime': 50 });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.frames.find((row: any) => row.id === 3).source).toBe('/assets/lib.js');
    expect(result.frames.find((row: any) => row.id === 1).parentId).toBeNull();
    expect(result.frames.find((row: any) => row.id === 3).parentId).toBe(2);
    expect(result.frames.find((row: any) => row.id === 2).parentId).toBe(1);
    expect(() => summarizeAllocationProfile({ head: profile.head, samples: [{ nodeId: 99, size: 10 }] })).toThrow();
  });
});
