/** Private verification plumbing. Never connects to an existing user's browser. */
import assert from 'node:assert/strict';

// Playwright exposes page/frame CDP sessions, not a Worker session. Nest a
// session through the owned browser's Target domain and retain its exact ID.
export function nestedTargetSession(root, sessionId, timeoutMs = 15000) {
  let sequence = 0;
  let closed = false;
  const pending = new Map();
  const finish = (id, error, result) => {
    const item = pending.get(id);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(id);
    if (error) item.reject(error); else item.resolve(result);
  };
  const message = (event) => {
    if (event.sessionId !== sessionId) return;
    let payload;
    try { payload = JSON.parse(event.message); } catch { return; }
    if (!Number.isSafeInteger(payload.id)) return;
    finish(payload.id, payload.error ? new Error(`Worker CDP failed: ${payload.error.code}`) : null, payload.result);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    root.off('Target.receivedMessageFromTarget', message);
    root.off('Target.detachedFromTarget', detached);
    for (const id of pending.keys()) finish(id, new Error('Owned Worker CDP session closed'));
  };
  const detached = (event) => { if (event.sessionId === sessionId) close(); };
  root.on('Target.receivedMessageFromTarget', message);
  root.on('Target.detachedFromTarget', detached);
  return {
    async send(method, params = {}) {
      if (closed) throw new Error('Owned Worker CDP session closed');
      if (pending.size >= 32) throw new Error('Worker CDP pending request bound exceeded');
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(id, new Error('Worker CDP response timeout')), timeoutMs);
        pending.set(id, { resolve, reject, timer });
        Promise.resolve().then(() => { if (closed || !pending.has(id)) return; return root.send('Target.sendMessageToTarget', {
          sessionId, message: JSON.stringify({ id, method, params })
        }); }).catch((error) => finish(id, error));
      });
    },
    close
  };
}

export function selectOwnedWorker(targets, pageInfo, workerUrl) {
  const url = new URL(workerUrl);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only an owned loopback Worker can be profiled');
  const selected = targets.filter((target) => target.type === 'worker'
    && target.url === workerUrl && target.browserContextId === pageInfo.browserContextId
    && (!target.openerId || target.openerId === pageInfo.targetId));
  assert.equal(selected.length, 1, 'Worker target missing or ambiguous; never profile a different isolate');
  return selected[0];
}

export function summarizeAllocationProfile(profile) {
  assert(profile?.head && Array.isArray(profile.samples), 'Missing allocation sampling profile');
  const rows = [];
  const stack = [{ node: profile.head, ancestry: [] }];
  const byId = new Map();
  while (stack.length) {
    const { node, ancestry } = stack.pop();
    assert(Number.isFinite(node.selfSize) && node.selfSize >= 0, 'Invalid allocation node size');
    assert(!byId.has(node.id), 'Duplicate allocation profile node');
    const frame = node.callFrame ?? {};
    const lineage = [...ancestry, frame.functionName ?? ''];
    let scope = 'unattributed-runtime';
    if (lineage.some((name) => /encodeWorkerLayout|jsonBytes|encodeObjectGraph/.test(name))) scope = 'host-codec';
    else if (lineage.some((name) => /resolveAnnotationLayout|refineAnnotationLayout|createIncrementalAnnotationLayoutSession|resolvePlacementCandidate|resolveAnnotation|captureLayout|scorePlacementCandidate|placementSearchSpace|candidateGeometry|connectorPath|nearestPointOnBox|allPlacementCandidates/.test(name))) scope = 'layout';
    else if (frame.url) scope = 'other-javascript';
    let source = '';
    if (frame.url) {
      try { const u = new URL(frame.url); source = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ? u.pathname : '[external-source]'; }
      catch { source = '[non-url-source]'; }
    }
    const row = { id: node.id, function: frame.functionName || '(anonymous)', source,
      line: frame.lineNumber ?? -1, column: frame.columnNumber ?? -1,
      scope, sampledBytes: node.selfSize };
    rows.push(row); byId.set(node.id, row);
    for (const child of node.children ?? []) stack.push({ node: child, ancestry: lineage });
  }
  const totals = { layout: 0, 'host-codec': 0, 'other-javascript': 0, 'unattributed-runtime': 0 };
  for (const row of rows) totals[row.scope] += row.sampledBytes;
  const samples = profile.samples.map((sample) => {
    assert(byId.has(sample.nodeId) && Number.isFinite(sample.size) && sample.size >= 0, 'Invalid allocation sample');
    return { nodeId: sample.nodeId, size: sample.size, ordinal: sample.ordinal };
  });
  return { sampledBytes: rows.reduce((total, row) => total + row.sampledBytes, 0), totals,
    // Keep the complete sanitized frame/sample data, not just top-N winners.
    frames: rows, samples,
    interpretation: 'Statistical V8 allocation samples include collected objects. Not exact bytes allocated, retained heap, native clone allocations, peak RSS or causal subtraction between runs. Stack buckets are descriptive; unlabelled runtime work stays unattributed.' };
}

export async function createWorkerAllocationProfiler(browser, context, page) {
  const main = await context.newCDPSession(page);
  const root = await browser.newBrowserCDPSession();
  let worker;
  let sessionId;
  let sampling = false;
  try {
    const { targetInfo: pageInfo } = await main.send('Target.getTargetInfo');
    const workers = page.workers();
    assert.equal(workers.length, 1, 'Owned fixture must have exactly one Worker');
    const { targetInfos } = await root.send('Target.getTargets');
    const target = selectOwnedWorker(targetInfos, pageInfo, workers[0].url());
    ({ sessionId } = await root.send('Target.attachToTarget', { targetId: target.targetId, flatten: false }));
    worker = nestedTargetSession(root, sessionId);
    const [mainId, workerId] = await Promise.all([main.send('Runtime.getIsolateId'), worker.send('Runtime.getIsolateId')]);
    assert(mainId.id && workerId.id && mainId.id !== workerId.id, 'Worker allocation requires a verified distinct V8 isolate');
    await main.send('HeapProfiler.enable'); await worker.send('HeapProfiler.enable');
    const heap = async () => ({ main: await main.send('Runtime.getHeapUsage'), worker: await worker.send('Runtime.getHeapUsage') });
    const stop = async () => {
      const results = await Promise.allSettled([main.send('HeapProfiler.stopSampling'), worker.send('HeapProfiler.stopSampling')]);
      sampling = false;
      const failure = results.find((entry) => entry.status === 'rejected');
      if (failure) throw failure.reason;
      return { main: summarizeAllocationProfile(results[0].value.profile), worker: summarizeAllocationProfile(results[1].value.profile) };
    };
    return {
      identity: { distinctIsolates: true, targetType: target.type, workerPath: new URL(target.url).pathname,
        sampleInterval: 32768, stackDepth: 64, collectedObjectsIncluded: true },
      heap,
      async start() {
        assert(!sampling, 'Allocation sampling already active');
        sampling = true;
        try {
          const options = { samplingInterval: 32768, stackDepth: 64,
            includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true };
          await main.send('HeapProfiler.startSampling', options);
          await worker.send('HeapProfiler.startSampling', options);
        } catch (error) { await stop().catch(() => {}); throw error; }
        return heap();
      },
      async finish() { assert(sampling, 'No active allocation sample'); const allocation = await stop(); return { allocation, after: await heap() }; },
      async afterCollection() {
        assert(!sampling, 'Do not force collection inside measured sampling intervals');
        await main.send('HeapProfiler.collectGarbage'); await worker.send('HeapProfiler.collectGarbage');
        return heap();
      },
      async close() {
        if (sampling) await stop().catch(() => {});
        worker.close();
        await root.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        await main.detach(); await root.detach();
      }
    };
  } catch (error) {
    worker?.close();
    if (sessionId) await root.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    await main.detach().catch(() => {}); await root.detach().catch(() => {});
    throw error;
  }
}
