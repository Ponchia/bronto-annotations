// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupPlaygroundExports } from '../../site/playground-export.js';

const recipe = '// café <script> remains text\nconst notes = ["first"];';
const copy = () => document.querySelector<HTMLButtonElement>('[data-copy-target]')!;
const manual = () => document.querySelector<HTMLTextAreaElement>('.copy-feedback textarea')!;
const status = () => document.querySelector('.copy-feedback [role="status"]')!;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const clipboard = (writeText?: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: writeText ? { writeText } : undefined,
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="scene-source-toolbar"><button data-copy-target="scene-source-code">Copy code</button>' +
    '<button id="download-scene-code">Download .ts</button></div>' +
    '<p id="scene-download-status" role="status"></p><pre id="scene-source-code"></pre>' +
    '<div class="install"><button data-copy="npm install @ponchia/annotations@0.8.3">Copy</button></div>';
  document.querySelector('#scene-source-code')!.textContent = recipe;
  setupPlaygroundExports();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('site copy recovery', () => {
  it('preserves the exact static install command as well as code-target copying', async () => {
    const write = vi.fn(async (_text: string) => {});
    clipboard(write);
    const install = document.querySelector<HTMLButtonElement>('.install button')!;
    install.click();
    document.querySelector('#scene-source-code')!.textContent = 'new recipe';
    await flush();
    expect(write).toHaveBeenCalledExactlyOnceWith('npm install @ponchia/annotations@0.8.3');
    vi.advanceTimersByTime(1500);
    expect(install.textContent).toBe('Copy');
  });

  it.each(['missing', 'denied'])('selects a labeled, read-only text snapshot when clipboard is %s', async (failure) => {
    clipboard(failure === 'missing' ? undefined : async () => { throw new Error('Denied'); });
    copy().click();
    await flush();
    expect(manual().value).toBe(recipe);
    expect(manual().readOnly).toBe(true);
    expect(manual().labels?.[0]?.textContent).toContain('captured when you clicked');
    expect(document.activeElement).toBe(manual());
    expect([manual().selectionStart, manual().selectionEnd]).toEqual([0, recipe.length]);
    expect(status().textContent).toContain('Clipboard unavailable');
    vi.advanceTimersByTime(10000);
    expect(status().textContent).toContain('Clipboard unavailable');
    expect(document.querySelector('script')).toBeNull();
  });

  it('preserves clicked bytes after the live scene changes during a permission prompt', async () => {
    let reject!: (error: Error) => void;
    const write = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    clipboard(write);
    copy().click();
    document.querySelector('#scene-source-code')!.textContent = 'new scene';
    reject(new Error('Denied'));
    await flush();
    expect(write).toHaveBeenCalledWith(recipe);
    expect(manual().value).toBe(recipe);
  });

  it('keeps a captured manual recipe when the surrounding scene form is reset', async () => {
    const form = document.createElement('form');
    form.append(...document.body.childNodes);
    document.body.append(form);
    copy().type = 'button';
    clipboard();
    copy().click();
    await flush();
    form.reset();
    expect(manual().value).toBe(recipe);
  });

  it('restores the original label after repeated successful clicks and restarts its feedback timer', async () => {
    clipboard(async () => {});
    copy().click();
    await flush();
    expect(copy().textContent).toBe('Copied');
    vi.advanceTimersByTime(1000);
    copy().click();
    await flush();
    vi.advanceTimersByTime(500);
    expect(copy().textContent).toBe('Copied');
    vi.advanceTimersByTime(1000);
    expect(copy().textContent).toBe('Copy code');
    expect(status().textContent).toContain('Copied the text');
  });

  it.each(['resolve', 'reject'] as const)('ignores an older request that later %ss', async (late) => {
    const requests: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
    clipboard(() => new Promise<void>((resolve, reject) => { requests.push({ resolve, reject }); }));
    copy().click();
    document.querySelector('#scene-source-code')!.textContent = 'new scene';
    copy().click();
    requests[1]!.reject(new Error('New request denied'));
    await flush();
    const feedback = status().textContent;
    // A delayed rejection must not steal focus after the user moves on.
    if (late === 'reject') document.querySelector<HTMLButtonElement>('#download-scene-code')!.focus();
    if (late === 'resolve') requests[0]!.resolve();
    else requests[0]!.reject(new Error('Old request denied'));
    await flush();
    expect(manual().value).toBe('new scene');
    expect(status().textContent).toBe(feedback);
    expect(document.activeElement).toBe(late === 'reject'
      ? document.querySelector('#download-scene-code') : manual());
    expect([manual().selectionStart, manual().selectionEnd]).toEqual([0, 'new scene'.length]);
    expect(copy().textContent).toBe('Copy code');
  });

  it('ignores an older rejection after the latest copy succeeds', async () => {
    let reject!: (error: Error) => void;
    clipboard(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    copy().click();
    clipboard(async () => {});
    copy().focus();
    copy().click();
    await flush();
    reject(new Error('Old permission request denied'));
    await flush();
    expect(manual().parentElement?.hidden).toBe(true);
    expect(document.activeElement).toBe(copy());
    expect(copy().textContent).toBe('Copied');
    expect(status().textContent).toContain('Copied the text');
  });

  it('clears a previous manual fallback when a later retry succeeds', async () => {
    clipboard();
    copy().click();
    await flush();
    clipboard(async () => {});
    copy().click();
    await flush();
    expect(manual().parentElement?.hidden).toBe(true);
    expect(status().textContent).toContain('Copied the text');
  });
});

describe('scene download', () => {
  it('uses a fixed TypeScript filename, text blob and delayed URL cleanup', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:scene');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    let clicked: { name: string; href: string; attached: boolean } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { name: this.download, href: this.href, attached: this.isConnected };
    });
    document.querySelector<HTMLButtonElement>('#download-scene-code')!.click();
    expect(clicked).toEqual({ name: 'annotation-scene.ts', href: 'blob:scene', attached: true });
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
    expect(blob.size).toBe(new TextEncoder().encode(recipe).length);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:scene');
    expect(document.querySelector('#scene-download-status')?.textContent).toContain('Download requested');
  });

  it('reports a failed download without leaving a temporary link or URL behind', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:scene', revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('Refused'); });
    document.querySelector<HTMLButtonElement>('#download-scene-code')!.click();
    expect(document.querySelector('#scene-download-status')?.textContent).toContain('Download unavailable');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:scene');
  });
});
