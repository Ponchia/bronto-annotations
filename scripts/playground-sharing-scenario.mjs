import assert from 'node:assert/strict';

/** Public DOM behavior; clipboard stubs exercise success and denied permission. */
export async function verifyPlaygroundSharing(home) {
  const read = (page) => page.evaluate(() => ({
    count: document.querySelector('#notes-count').value,
    obstacle: document.querySelector('#obstacle-size').value,
    routing: document.querySelector('#route-style').value,
    placement: document.querySelector('#placement-mode').value,
    score: document.querySelector('#annotation-overlay').dataset.score,
    noteOverlap: document.querySelector('#annotation-overlay').dataset.noteOverlap,
    obstacleOverlap: document.querySelector('#annotation-overlay').dataset.obstacleOverlap,
    source: document.querySelector('#scene-source-code').textContent,
  }));
  const before = await read(home);
  const toggle = home.locator('#toggle-placement');
  await toggle.click();
  assert.equal(await home.locator('#placement-mode').inputValue(), 'fixed');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await toggle.click();
  assert.deepEqual(await read(home), before, 'The adjacent compare action must preserve all scene inputs');

  await home.locator('button[data-scene="crowded"]').click();
  await home.locator('#route-style').selectOption('none');
  await home.locator('#placement-mode').selectOption('fixed');
  const expected = await read(home);
  const link = await home.locator('#scene-link').inputValue();
  assert(new URL(link).hash.startsWith('#playground?v=1&'));
  assert.equal(new URL(link).search, '', 'Share links must not propagate unrelated query strings');
  const restored = await home.context().newPage();
  try {
    await restored.goto(link, { waitUntil: 'networkidle' });
    assert.deepEqual(await read(restored), expected, 'A shared link must reproduce its settings, geometry metrics and copied code');
    assert.match(await restored.locator('#scene-link-status').innerText(), /Shared scene restored/);

    // These stubs deliberately verify application behavior, not OS clipboard access.
    await restored.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => { window.__copiedSceneLink = text; } },
      });
    });
    await restored.locator('#copy-scene-link').click();
    assert.equal(await restored.evaluate(() => window.__copiedSceneLink), link);
    assert.match(await restored.locator('#scene-link-status').innerText(), /Scene link copied/);
    await restored.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('Permission denied'); } },
      });
    });
    await restored.locator('#copy-scene-link').click();
    assert.match(await restored.locator('#scene-link-status').innerText(), /Clipboard unavailable/);
    const selected = await restored.locator('#scene-link').evaluate((element) => ({
      focused: element === document.activeElement,
      start: element.selectionStart,
      end: element.selectionEnd,
      length: element.value.length,
    }));
    assert(selected.focused, 'Denied clipboard access must focus the manually copyable link');
    assert.equal(selected.start, 0);
    assert.equal(selected.end, selected.length, 'Manual copy fallback must select the entire current link');
    assert.equal(await restored.locator('#scene-link').inputValue(), link);
    await restored.keyboard.press('Enter');
    await restored.waitForLoadState('networkidle');
    assert.equal(restored.url(), link, 'Enter in the scene-link field must not submit the form');
    assert.deepEqual(await read(restored), expected);

    const alternative = '#playground?v=1&notes=2&obstacle=80&routing=orthogonal&placement=automatic';
    await restored.evaluate((hash) => { location.hash = hash; }, alternative);
    await restored.waitForFunction(() => document.querySelector('#notes-count')?.value === '2');
    assert.equal(await restored.locator('#obstacle-size').inputValue(), '80');
    const afterValidHash = await read(restored);
    await restored.evaluate(() => { location.hash = '#examples'; });
    await restored.waitForFunction(() => location.hash === '#examples');
    assert.deepEqual(await read(restored), afterValidHash, 'Ordinary section navigation must not reset the scene');

    await restored.evaluate(() => {
      location.hash = '#playground?v=99&notes=999&obstacle=150&routing=none&placement=fixed';
    });
    await restored.waitForFunction(() => document.querySelector('#scene-link-status')?.textContent?.includes('invalid'));
    assert.equal(await restored.locator('#notes-count').inputValue(), '3');
    assert.equal(await restored.locator('#obstacle-size').inputValue(), '150');
    assert.equal(await restored.locator('#placement-mode').inputValue(), 'automatic');
    assert.equal(await restored.locator('#route-style').inputValue(), 'orthogonal');
  } finally {
    await restored.close();
  }
  await home.locator('.scene-share input').focus();
  await home.locator('#annotation-controls > button[type="reset"]').click();
  await home.waitForFunction(() => document.querySelector('#notes-count')?.value === '3');
  assert.deepEqual(await read(home), before, 'Reset must restore the scene and copied source after sharing');
}
