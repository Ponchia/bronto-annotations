// Shared browser scenario for the maintained example gate. The caller owns
// the browser, loopback origin and evidence directory; no extra CLI is required.
export async function verifyResponsiveAuthoring(page, { origin, evidenceDirectory }) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const inputs = () => page.locator('#annotation-json').textContent();
  const select = () => page.locator('#text-editor-note').inputValue();
  const load = async notes => {
    await page.locator('.annotation-source summary').click();
    await page.locator('#annotation-import-input').fill(JSON.stringify(notes));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(count => document.querySelectorAll('.note-list li').length === count, notes.length);
    await page.locator('.annotation-source summary').click();
  };
  const noOverflow = async label => {
    const sizes = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    check(sizes.scroll <= sizes.width + 1, `${label}: page overflows ${JSON.stringify(sizes)}`);
  };

  for (const width of [1200, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${origin}/examples/react-incremental/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__annotationsExample));
    await page.waitForFunction(expected =>
      document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === expected,
    width === 390 ? 'false' : 'true');
    check(await page.locator('.note-list li').count() === 4, 'Every initial note has a list row');
    await noOverflow(`initial ${width}`);
    await page.screenshot({ path: `${evidenceDirectory}/${width}-default.png`, fullPage: true });

    if (width === 1200) {
      const original = await inputs();
      await page.locator('.pa-annotation__note-box[data-annotation-id="signal"]').focus();
      await page.locator('.demo-card').evaluate(el => { el.style.width = '340px'; });
      await page.waitForFunction(() => document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === 'false');
      check(await page.locator('#diagram-disclosure').evaluate(el => el === document.activeElement), 'Responsive collapse restores focus to its disclosure');
      check(await inputs() === original, 'Host resize leaves authored input unchanged');
      await page.locator('.demo-card').evaluate(el => { el.style.width = ''; });
      await page.waitForFunction(() => document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === 'true');
    }

    const beforeSelection = await inputs();
    const rows = page.locator('.note-list button');
    await rows.first().focus();
    await page.keyboard.press('End');
    check(await select() === 'signal', 'End selects final note');
    await page.keyboard.press('ArrowDown');
    check(await select() === 'intake', 'ArrowDown wraps selection');
    await page.keyboard.press('Home');
    check(await inputs() === beforeSelection, 'Selection must not rewrite geometry or history');
    await page.getByRole('link', { name: 'Edit selected note' }).click();
    check(await page.locator('#text-editor-title').evaluate(el => el === document.activeElement), 'Edit link focuses title');
    await page.locator('#text-editor-title').fill('Keyboard revision');
    await page.locator('#text-editor-title').press('Enter');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Edited intake text');
    check(await page.locator('#text-editor-title').evaluate(el => el === document.activeElement), 'Apply preserves title focus');
    check(await rows.first().textContent().then(text => text.includes('Keyboard revision')), 'List follows committed text');
    await page.getByRole('button', { name: 'Return to selected note' }).click();
    check(await rows.first().evaluate(el => el === document.activeElement), 'Return restores selected row focus');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Undid: Edited intake text');
    check(await inputs() === beforeSelection, 'Keyboard undo restores authored input');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Redid: Edited intake text');

    const beforeNavigation = await inputs();
    await page.locator('#go-to-diagram').focus();
    await page.keyboard.press('Enter');
    await page.locator('#full-diagram').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.classList.contains('stage-scroll'));
    check(await inputs() === beforeNavigation, 'Diagram navigation never rewrites authored state');
    await page.locator('#back-to-notes').click();
    check(await rows.first().evaluate(el => el === document.activeElement), 'Diagram return restores selected list focus');
    const note = page.locator('.pa-annotation__note-box[data-annotation-id="signal"]');
    await note.focus();
    check(await select() === 'signal', 'Diagram focus synchronizes list/editor selection');
    await page.locator('#move-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Moved the final anchor');
    check(await page.locator('#diagram-disclosure').getAttribute('aria-expanded') === 'true', 'Editing preserves explicit full detail');
    const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="signal"]').first();
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    const box = await handle.boundingBox();
    check(box && box.width > 0, 'Geometry handle remains available');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 14, box.y + box.height / 2 - 10, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Edited signal by dragging');
    await noOverflow(`full-detail ${width}`);
    await page.locator('.stage-scroll').evaluate(el => { el.scrollLeft = 0; });
    await page.locator('#full-diagram').screenshot({ path: `${evidenceDirectory}/${width}-diagram.png` });

    const stable = await inputs();
    await page.locator('.annotation-source summary').click();
    await page.locator('#annotation-import-input').fill('{invalid JSON');
    await page.locator('#load-annotation-json').click();
    check(await page.locator('#annotation-import-error').isVisible(), 'Invalid import reports an error');
    check(await inputs() === stable && await select() === 'signal', 'Invalid import preserves data and selection');
    await page.locator('.annotation-source summary').click();

    // Fresh host policy: ten deliberately overlapping notes, long text,
    // arbitrary IDs, a hidden high-priority note and a selected low priority.
    await page.reload({ waitUntil: 'networkidle' });
    const dense = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? '__proto__' : index === 9 ? 'signal' : `quotes " [${index}]`,
      priority: index === 0 ? 100 : -index,
      anchor: { type: 'point', point: { x: 435, y: 248 } },
      note: { title: `Crowded note ${index + 1}`, body: `${index}: ` + 'unbroken'.repeat(45), visible: index !== 0 },
      placement: { manual: { x: 307, y: 83, side: 'top' } }
    }));
    await load(dense);
    await page.waitForFunction(() => document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === 'false');
    check(await select() === 'signal', 'Retain still-existing selected ID across import');
    check(JSON.stringify(JSON.parse(await inputs())) === JSON.stringify(dense), 'Dense presentation preserves all authored inputs');
    const bodies = await page.locator('.note-list li p').allTextContents();
    check(JSON.stringify(bodies) === JSON.stringify(dense.map(note => note.note.body)), 'Every full body remains readable in authored order');
    await noOverflow(`crowded ${width}`);
    await page.locator('.note-list').screenshot({ path: `${evidenceDirectory}/${width}-crowded.png` });
    await page.locator('#remove-note').click();
    await page.waitForFunction(() => document.querySelector('#text-editor-note')?.value === '__proto__');
    check(await page.locator('.note-list button[aria-pressed="true"]').getAttribute('data-note-id') === '__proto__', 'Removal recovers list and editor selection');
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() => document.querySelectorAll('.note-list li').length === 10);
    check(await select() === '__proto__', 'Undo does not resurrect removed stale selection');
    await load([dense[1]]);
    check(await select() === dense[1].id, 'Import recovers selection for opaque quoted IDs');
    await page.getByRole('button', { name: 'Return to selected note' }).click();
    check(await page.locator('.note-list button').evaluate(el => el === document.activeElement), 'Opaque ID focus restoration uses data rather than selectors');
    await noOverflow(`replacement ${width}`);
  }
  check(errors.length === 0, `Browser errors: ${errors.join('\n')}`);
  return { passed: true, widths: [1200, 390], checks: 'full text, crowded fallback, selection, keyboard edit/undo/redo, drag, invalid import, recovery, overflow',
    acceptance: 'Automated Chromium viewport checks; screen reader and physical device acceptance remain unperformed.' };
}


/** Existing geometry tests explicitly enter the optional full-detail view. */
export async function openEditorDiagram(page) {
  await page.locator('.note-list').waitFor({ state: 'visible' });
  const control = page.locator('#diagram-disclosure');
  await control.waitFor({ state: 'visible' });
  if (await control.getAttribute('aria-expanded') !== 'true') await control.click();
  await page.locator('#full-diagram').waitFor({ state: 'visible' });
}
