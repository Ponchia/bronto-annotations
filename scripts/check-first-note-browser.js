async page => {
  const start = page.url();
  const results = [];
  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(start);
    await page.locator('#controls:not([hidden])').waitFor();
    ensure(await page.locator('.pa-annotation').count() === 1, 'Expected one real annotation');
    await page.locator('#note-title').fill('Reviewed signal');
    ensure((await page.locator('#notes').innerText()).includes('Reviewed signal'), 'Title did not update');
    await page.locator('#toggle').click();
    ensure(!await page.locator('#notes').isVisible(), 'Hide did not hide the annotation');
    await page.locator('#reset').click();
    ensure(await page.locator('#note-title').inputValue() === 'Deployment starts', 'Reset failed');
    ensure(await page.locator('#notes').isVisible(), 'Reset did not restore visibility');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflows');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Enlarged text overflows');
    results.push({ width, title: true, hide: true, reset: true, reflow: true });
  }
  await page.goto(start);
  await page.locator('#controls:not([hidden])').waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-example').click()]);
  ensure(download.suggestedFilename() === 'first-annotation.html', 'Download filename differs');
  return { passed: true, results, download: download.suggestedFilename() };
}
