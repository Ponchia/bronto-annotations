export interface SitePublicationRecord { schemaVersion: 1; stableVersion: string; previewVersion: string | null; }
export interface SiteReleaseStatus { sourceVersion: string; stableVersion: string; previewVersion: string | null; sourcePublished: boolean; stableInstall: string; stableDocs: string; }
export function siteReleaseStatus(sourceVersion: string, record: SitePublicationRecord): SiteReleaseStatus;
export function renderReleaseNotice(status: SiteReleaseStatus, prefix?: string): string;
export function injectReleaseNotice(html: string, status: SiteReleaseStatus, prefix?: string): string;
export function offersInstall(text: string, version: string): boolean;
