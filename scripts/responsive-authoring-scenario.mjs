/** Check the initial reading surface before any deliberate diagram override. */
export async function verifyAuthoringDefault(page, label = 'incremental authoring') {
  const check = (condition, message) => { if (!condition) throw new Error(`${label}: ${message}`); };
  await page.waitForFunction(() => Boolean(window.__annotationsExample?.quality));
  await page.waitForFunction(() => {
    const card = document.querySelector('.demo-card');
    const expected = card.clientWidth >= 690 && window.__annotationsExample.quality.ok;
    return document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === String(expected);
  });
  const notes = JSON.parse(await page.locator('#annotation-json').textContent());
  check(await page.locator('.note-list li').count() === notes.length, 'reading list dropped an authored note');
  const titles = await page.locator('.note-list li button strong').allTextContents();
  check(JSON.stringify(titles) === JSON.stringify(notes.map(note => note.note.title?.trim() || note.id)),
    'reading list changed authored order or titles');
  const bodies = await page.locator('.note-list li p').allTextContents();
  check(JSON.stringify(bodies) === JSON.stringify(notes.filter(note => note.note.body).map(note => note.note.body)),
    'reading list lost full authored text');
  check(await page.locator('.note-list li p').evaluateAll(elements => elements.every(element =>
    element.getClientRects().length > 0 && element.scrollHeight <= element.clientHeight + 1
      && element.scrollWidth <= element.clientWidth + 1)), 'reading list clips or hides body text');
  check(await page.locator('.note-list').isVisible(), 'default reading list is hidden');
  const narrow = await page.locator('.demo-card').evaluate(card => card.clientWidth < 690);
  if (narrow) {
    check(await page.locator('#diagram-disclosure').getAttribute('aria-expanded') === 'false',
      'narrow default must start with the diagram collapsed');
    check(await page.locator('#full-diagram').isHidden(), 'narrow default exposes the full graph before the list');
  }
}

/** Establish a user choice so later edits/crowding cannot hide geometry tests. */
export async function openAuthoringDiagram(page) {
  const before = await page.locator('#annotation-json').textContent();
  const changes = await page.evaluate(() => window.__annotationsExample.changes);
  const toggle = page.locator('#diagram-disclosure');
  if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
  await toggle.click();
  await page.locator('#full-diagram').waitFor({ state: 'visible' });
  if (await page.locator('#annotation-json').textContent() !== before
    || await page.evaluate(() => window.__annotationsExample.changes) !== changes) {
    throw new Error('Opening the full diagram mutated authored inputs or history');
  }
}

// Shared real-Playwright scenario, exercised by the mandatory test:browser gate.
export async function verifyResponsiveAuthoring(page, { origin, screenshotsDir, widths = [1200, 390] }) {
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

  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${origin}/examples/react-incremental/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__annotationsExample));
    await page.waitForFunction(expected =>
      document.querySelector('#diagram-disclosure')?.getAttribute('aria-expanded') === expected,
    width === 390 ? 'false' : 'true');
    check(await page.locator('.note-list li').count() === 4, 'Every initial note has a list row');
    await noOverflow(`initial ${width}`);
    await page.screenshot({ path: `${screenshotsDir}/${width}-default.png`, fullPage: true });

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

    const beforeNavigation = await inputs();
    const selectionBeforeNavigation = await select();
    const changesBeforeNavigation = await page.evaluate(() => window.__annotationsExample.changes);
    await page.locator('#go-to-diagram').focus();
    await page.keyboard.press('Enter');
    await page.locator('#full-diagram').waitFor({ state: 'visible' });
    check(await page.locator('.stage-scroll').evaluate(el => el === document.activeElement),
      'Keyboard shortcut opens and focuses the existing diagram stage');
    // At the document end, block:start is clamped by the available scroll
    // range. Assert the reachable aligned position and full available visibility,
    // rather than demanding an impossible <100px top margin in every viewport.
    await page.waitForFunction(() => {
      const stage = document.querySelector('.stage-scroll').getBoundingClientRect();
      const scrolling = document.scrollingElement;
      const target = Math.min(stage.top + scrolling.scrollTop,
        Math.max(0, scrolling.scrollHeight - window.innerHeight));
      const visible = Math.max(0, Math.min(stage.bottom, window.innerHeight) - Math.max(0, stage.top));
      return Math.abs(scrolling.scrollTop - target) <= 1
        && visible >= Math.min(stage.height, window.innerHeight) - 1;
    }, null, { timeout: 5000 });
    await page.keyboard.press('Shift+Tab');
    check(await page.locator('#diagram-return').evaluate(el => el === document.activeElement),
      'The stage has an immediate keyboard return path');
    await page.keyboard.press('Enter');
    check(await page.locator('.note-list button[aria-pressed="true"]').evaluate(el => el === document.activeElement),
      'Keyboard return restores selected note focus');
    check(await inputs() === beforeNavigation && await select() === selectionBeforeNavigation
      && await page.evaluate(() => window.__annotationsExample.changes) === changesBeforeNavigation,
    'Diagram navigation preserves selection, authored geometry and history');

    const beforeSelection = await inputs();
    const rows = page.locator('.note-list button');

    // A geometry update replaces the selected annotation object. Its unapplied
    // text must survive; discarding the draft must not undo that geometry edit.
    await rows.last().focus();
    const savedTitle = await page.locator('#text-editor-title').inputValue();
    const savedBody = await page.locator('#text-editor-body').inputValue();
    await page.locator('#text-editor-title').fill('Draft survives movement');
    await page.locator('#text-editor-body').fill('Unapplied explanation.');
    const beforeDraftMove = await page.evaluate(() => window.__annotationsExample.changes);
    await page.locator('#move-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Moved the final anchor');
    check(await page.locator('#text-editor-title').inputValue() === 'Draft survives movement'
      && await page.locator('#text-editor-body').inputValue() === 'Unapplied explanation.',
    'Moving the selected anchor must preserve its unapplied text');
    const movedInputs = await inputs();
    check(movedInputs !== beforeSelection, 'The draft check must exercise a real geometry update');
    check(JSON.parse(movedInputs).find(note => note.id === 'signal').note.title === savedTitle,
      'Draft text must remain outside the committed annotation inputs');
    check(await page.locator('#text-editor-draft-status').innerText().then(value => value.includes('Unapplied text')),
      'The draft status must identify unapplied changes');
    await page.locator('.note-text-editor').screenshot({ path: `${screenshotsDir}/${width}-unapplied-draft.png` });
    await page.locator('#discard-note-text').click();
    check(await page.locator('#text-editor-title').inputValue() === savedTitle
      && await page.locator('#text-editor-body').inputValue() === savedBody,
    'Discard restores the current authored text');
    check(await page.locator('#text-editor-title').evaluate(el => el === document.activeElement),
      'Discard restores keyboard focus to the title');
    check(await inputs() === movedInputs
      && await page.evaluate(() => window.__annotationsExample.changes) === beforeDraftMove + 1,
    'Discarding a text draft must preserve committed geometry and history');
    await page.locator('#undo-edit').click();
    check(await inputs() === beforeSelection, 'Undo after discard must undo the geometry move');

    await rows.first().focus();
    await page.keyboard.press('End');
    check(await select() === 'signal', 'End selects final note');
    await page.keyboard.press('ArrowDown');
    check(await select() === 'intake', 'ArrowDown wraps selection');
    await page.keyboard.press('Home');
    check(await inputs() === beforeSelection, 'Selection must not rewrite geometry or history');
    await page.keyboard.press('ArrowDown');
    check(await select() === 'triage', 'ArrowDown selects a middle note');
    await page.keyboard.press('Tab');
    const tabHandoff = await page.evaluate(() => ({
      selectedId: document.querySelector('#text-editor-note').value,
      focusedNoteId: document.activeElement?.getAttribute('data-note-id'),
      inEditor: document.querySelector('.note-text-editor').contains(document.activeElement)
    }));
    check(tabHandoff.selectedId === 'triage' && tabHandoff.inEditor,
      'Tab reaches the editor without selecting a later note: ' + JSON.stringify(tabHandoff));
    await page.keyboard.press('Shift+Tab');
    check(await rows.nth(1).evaluate(el => el === document.activeElement) && await select() === 'triage',
      'Shift+Tab returns to the selected middle note');
    await page.keyboard.press('Shift+Tab');
    check(await page.getByRole('link', { name: 'Edit selected note' }).evaluate(el => el === document.activeElement)
      && await select() === 'triage', 'Shift+Tab reaches the edit link without selecting an earlier note');
    await page.keyboard.press('Enter');
    check(await page.locator('#text-editor-title').evaluate(el => el === document.activeElement)
      && await select() === 'triage', 'Keyboard edit link focuses the selected middle note title');
    await page.locator('#text-editor-title').fill('Keyboard revision');
    await page.locator('#text-editor-title').press('Enter');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Edited triage text');
    check(await page.locator('#text-editor-title').evaluate(el => el === document.activeElement), 'Apply preserves title focus');
    check(await rows.nth(1).textContent().then(text => text.includes('Keyboard revision')), 'List follows committed text');
    check(JSON.stringify(JSON.parse(await inputs()).filter(note => note.id !== 'triage'))
      === JSON.stringify(JSON.parse(beforeSelection).filter(note => note.id !== 'triage')),
    'Keyboard editing changes only the chosen middle note');
    await page.locator('.note-text-editor').screenshot({ path: `${screenshotsDir}/${width}-keyboard-edit.png` });
    await page.getByRole('button', { name: 'Return to selected note' }).click();
    check(await rows.nth(1).evaluate(el => el === document.activeElement), 'Return restores selected row focus');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Undid: Edited triage text');
    check(await inputs() === beforeSelection, 'Keyboard undo restores authored input');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.waitForFunction(() => window.__annotationsExample?.action === 'Redid: Edited triage text');

    if (await page.locator('#diagram-disclosure').getAttribute('aria-expanded') === 'false') {
      await page.locator('#diagram-disclosure').click();
    }
    await page.locator('#full-diagram').waitFor({ state: 'visible' });
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
    await page.locator('#full-diagram').screenshot({ path: `${screenshotsDir}/${width}-diagram.png` });

    const stable = await inputs();
    await page.locator('.annotation-source summary').click();
    await page.locator('#annotation-import-input').fill('{invalid JSON');
    await page.locator('#load-annotation-json').click();
    check(await page.locator('#annotation-import-error').isVisible(), 'Invalid import reports an error');
    check(await inputs() === stable && await select() === 'signal', 'Invalid import preserves data and selection');
    await page.locator('.annotation-source summary').click();

    // Creating a note is an explicit selection change. Do not keep editing
    // the older note or silently commit its unapplied text.
    const beforeCreate = await inputs();
    const originalNotes = JSON.parse(beforeCreate);
    await page.locator('#text-editor-title').fill('Unapplied title before creating');
    await page.locator('#text-editor-body').fill('An old draft that must not be committed.');
    await page.locator('#append-note').click();
    await page.waitForFunction(count => document.querySelectorAll('.note-list li').length === count,
      originalNotes.length + 1);
    const createdInputs = await inputs();
    const createdNotes = JSON.parse(createdInputs);
    const addedNote = createdNotes.at(-1);
    check(!originalNotes.some(note => note.id === addedNote.id), 'Add creates a fresh note ID');
    check(await select() === addedNote.id, 'Add annotation selects the newly created note');
    check(await page.locator('.note-list button[aria-pressed="true"]').getAttribute('data-note-id') === addedNote.id,
      'The reading list selects the newly created note');
    await page.waitForFunction(() => document.activeElement?.id === 'text-editor-title');
    const addedEditor = await page.evaluate(() => ({
      selectedId: document.querySelector('#text-editor-note').value,
      title: document.querySelector('#text-editor-title').value,
      body: document.querySelector('#text-editor-body').value,
      focusedId: document.activeElement?.id
    }));
    check(addedEditor.title === addedNote.note.title && addedEditor.body === addedNote.note.body,
      'Selecting the new note replaces the previous unapplied draft with its authored text: '
      + JSON.stringify({ actual: addedEditor, expected: {
        selectedId: addedNote.id, title: addedNote.note.title, body: addedNote.note.body,
        focusedId: 'text-editor-title'
      } }));
    check(JSON.stringify(createdNotes.slice(0, -1)) === JSON.stringify(originalNotes),
      'Adding a note must not commit or change the previous note draft');

    await page.locator('#text-editor-title').fill('My newly added note');
    await page.locator('#apply-note-text').click();
    await page.waitForFunction(id => {
      const notes = JSON.parse(document.querySelector('#annotation-json').textContent);
      return notes.find(note => note.id === id)?.note.title === 'My newly added note';
    }, addedNote.id);
    const editedCreatedInputs = await inputs();
    check(JSON.stringify(JSON.parse(editedCreatedInputs).slice(0, -1)) === JSON.stringify(originalNotes),
      'Applying the new note title must leave all older notes unchanged');
    await noOverflow('added note ' + width);
    await page.locator('.note-text-editor').screenshot({ path: screenshotsDir + '/' + width + '-added-note.png' });

    await page.locator('#undo-edit').click();
    await page.waitForFunction(expected => document.querySelector('#annotation-json').textContent === expected,
      createdInputs);
    check(await select() === addedNote.id, 'Undoing new text keeps the added note selected');
    await page.locator('#undo-edit').click();
    await page.waitForFunction(expected => document.querySelector('#annotation-json').textContent === expected,
      beforeCreate);
    check(await select() === originalNotes[0].id, 'Undoing Add recovers the first remaining note');
    await page.locator('#redo-edit').click();
    await page.waitForFunction(expected => document.querySelector('#annotation-json').textContent === expected,
      createdInputs);
    check(await select() === originalNotes[0].id, 'Redoing Add does not resurrect the removed selection');
    await page.locator('#redo-edit').click();
    await page.waitForFunction(expected => document.querySelector('#annotation-json').textContent === expected,
      editedCreatedInputs);
    check(await select() === originalNotes[0].id, 'Redoing new text preserves the recovered selection');

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
    check(await page.locator('.note-list li p').evaluateAll(elements => elements.every(element =>
      element.getClientRects().length > 0 && element.scrollHeight <= element.clientHeight + 1
        && element.scrollWidth <= element.clientWidth + 1)), 'Crowded note bodies must remain visible and unclipped');
    await noOverflow(`crowded ${width}`);
    await page.locator('.note-list').screenshot({ path: `${screenshotsDir}/${width}-crowded.png` });
    const beforeBlockedAdd = await inputs();
    const blockedSelection = await select();
    const blockedChanges = await page.evaluate(() => window.__annotationsExample.changes);
    await page.locator('#text-editor-title').fill('Keep my draft at the note limit');
    check(await page.locator('#append-note').isDisabled(), 'Add is unavailable at the note limit');
    await page.locator('#append-note').evaluate(button => button.click());
    check(await inputs() === beforeBlockedAdd && await select() === blockedSelection
      && await page.evaluate(() => window.__annotationsExample.changes) === blockedChanges,
    'A blocked Add must not change authored state, selection or history');
    check(await page.locator('#text-editor-title').inputValue() === 'Keep my draft at the note limit'
      && await page.locator('#text-editor-title').evaluate(el => el === document.activeElement),
    'A blocked Add preserves the unapplied draft and its focus');

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
  return { passed: true, widths, checks: 'full text, crowded fallback, selection, create/edit/undo/redo, blocked add, keyboard selection handoff and edit/undo/redo, drag, invalid import, recovery, overflow',
    acceptance: 'Automated Chromium viewport checks; screen reader and physical device acceptance remain unperformed.' };
}
