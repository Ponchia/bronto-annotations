import type { Page } from 'playwright';

export type BrowserScreenshotEvidence = {
  screenshot?: string;
  screenshotError?: string;
};

export declare function evidenceName(label: string): string;
export declare function evidenceError(error: unknown): string;
export declare function captureBrowserEvidence(
  page: Pick<Page, 'screenshot'>,
  directory: string | undefined,
  label: string
): Promise<BrowserScreenshotEvidence>;
export declare function writeBrowserEvidence(
  directory: string | undefined,
  report: Record<string, unknown>
): Promise<void>;
