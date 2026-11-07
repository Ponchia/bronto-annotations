/** Clipboard-denied keyboard recovery and actual downloaded recipe bytes. */
export async function verifyPlaygroundExports(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const details = page.locator('details.scene-source');
  if (await details.getAttribute('open') === null) {
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
  }
  await page.locator('[data-scene="crowded"]').click();
  await page.locator('#placement-mode').selectOption('fixed');
  const source = page.locator('#scene-source-code');
  const expected = await source.textContent();
  const copy = page.locator('[data-copy-target="scene-source-code"]');
  const fallback = details.locator('.copy-feedback textarea');
  const status = details.locator('.copy-feedback [role="status"]');
  await page.evaluate(() => {
    window.__exportTest = {
      clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
      created: [], revoked: [],
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => new Promise((_resolve, reject) => { window.__exportTest.reject = reject; }),
    } });
  });
  try {
    await copy.focus();
    await page.keyboard.press('Space');
    // A pending copy must retain its clicked recipe, even across a scene change.
    await page.locator('[data-scene="sparse"]').click();
    await page.evaluate(() => window.__exportTest.reject(new Error('Permission denied')));
    await fallback.waitFor({ state: 'visible' });
    assert(await fallback.inputValue() === expected, 'Denied copy lost the clicked recipe');
    const selection = await fallback.evaluate(element => ({
      focused: document.activeElement === element,
      start: element.selectionStart, end: element.selectionEnd,
      labeled: element.labels.length > 0, readonly: element.readOnly,
    }));
    assert(selection.focused && selection.start === 0 && selection.end === expected.length,
      'Denied copy must focus and select the complete captured recipe');
    assert(selection.labeled && selection.readonly, 'Manual recovery needs a labeled read-only field');
    assert((await status.innerText()).includes('Clipboard unavailable'), 'Missing recovery status');
    assert(await source.textContent() !== expected, 'Pending-copy test must actually change the scene');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Manual recovery overflows the viewport');

    // A successful retry copies the new live recipe and removes the old fallback.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async text => { window.__exportTest.copied = text; } },
    }));
    await copy.focus();
    await page.keyboard.press('Enter');
    assert(await page.evaluate(() => window.__exportTest.copied) === await source.textContent(),
      'Retry copied stale source');
    assert(await fallback.isHidden(), 'Successful retry left the old fallback visible');

    await page.evaluate(() => {
      URL.createObjectURL = blob => {
        const url = window.__exportTest.create.call(URL, blob);
        window.__exportTest.created.push({ url, type: blob.type });
        return url;
      };
      URL.revokeObjectURL = url => {
        window.__exportTest.revoked.push(url);
        window.__exportTest.revoke.call(URL, url);
      };
    });
    const downloadButton = page.locator('#download-scene-code');
    await downloadButton.focus();
    const downloadable = await source.textContent();
    const received = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const download = await received;
    try {
      assert(download.suggestedFilename() === 'annotation-scene.ts', 'Unexpected download filename');
      const stream = await download.createReadStream();
      stream.setEncoding('utf8');
      let downloaded = '';
      for await (const part of stream) downloaded += part;
      assert(downloaded === downloadable, 'Downloaded bytes differ from the visible recipe');
      assert(await download.failure() === null, 'Browser reported download failure');
    } finally {
      await download.delete();
    }
    await page.waitForFunction(() => window.__exportTest.revoked.length === 1);
    const lifecycle = await page.evaluate(() => ({
      created: window.__exportTest.created, revoked: window.__exportTest.revoked,
      anchors: document.querySelectorAll('a[download]').length,
    }));
    assert(lifecycle.created.length === 1 && lifecycle.created[0].type === 'text/plain;charset=utf-8',
      'Scene download must be a single plain-text blob');
    assert(lifecycle.revoked[0] === lifecycle.created[0].url && lifecycle.anchors === 0,
      'Scene download left its temporary URL or link behind');
    assert((await page.locator('#scene-download-status').innerText()).includes('Download requested'),
      'Download needs an announced result');
  } finally {
    await page.evaluate(() => {
      const original = window.__exportTest;
      if (original.clipboard) Object.defineProperty(navigator, 'clipboard', original.clipboard);
      else delete navigator.clipboard;
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      delete window.__exportTest;
    });
    await page.locator('#annotation-controls > button[type="reset"]').click();
    await page.waitForFunction(() => document.querySelector('#annotation-overlay')?.dataset.scene === 'balanced');
  }
  return 'Keyboard clipboard recovery, clicked snapshot, retry and exact recipe download passed';
}
