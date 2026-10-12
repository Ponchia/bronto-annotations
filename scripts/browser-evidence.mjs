/**
 * Small evidence writer for the experimental Playwright browser suite.
 * It never influences annotation layout or user-visible rendering.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LABEL = /^(chromium|firefox|webkit)\/(desktop|mobile)\/(incremental|dom-measure|react-flow|worker)$/;

export function evidenceName(label) {
  if (typeof label !== 'string' || !LABEL.test(label)) {
    throw new Error(`Unexpected browser evidence label: ${String(label)}`);
  }
  return `${label.replaceAll('/', '-')}.png`;
}

export function evidenceError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

export async function captureBrowserEvidence(page, directory, label) {
  if (!directory) return {};
  const file = evidenceName(label);
  try {
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: join(directory, file),
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      timeout: 12000
    });
    return { screenshot: file };
  } catch (error) {
    return { screenshotError: evidenceError(error) };
  }
}

export async function writeBrowserEvidence(directory, report) {
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'results.json'),
    JSON.stringify({ schema: 1, ...report }, null, 2) + '\n', 'utf8');
}
