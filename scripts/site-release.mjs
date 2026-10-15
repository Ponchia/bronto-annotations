/** Build-time publication facts; no registry request, cookie or runtime script. */
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function siteReleaseStatus(sourceVersion, record) {
  if (!versionPattern.test(sourceVersion) || !record || record.schemaVersion !== 1
    || !versionPattern.test(record.stableVersion) || record.stableVersion.includes('-')
    || (record.previewVersion !== null && (!versionPattern.test(record.previewVersion)
      || !record.previewVersion.includes('-')))) {
    throw new Error('Invalid site publication record');
  }
  return {
    sourceVersion,
    stableVersion: record.stableVersion,
    previewVersion: record.previewVersion,
    sourcePublished: sourceVersion === record.stableVersion || sourceVersion === record.previewVersion,
    stableInstall: `npm install @ponchia/annotations@${record.stableVersion}`,
    stableDocs: `https://github.com/Ponchia/bronto-annotations/blob/v${record.stableVersion}/docs/README.md`
  };
}

export function renderReleaseNotice(status, prefix = './') {
  if (!/^(?:\.\/|(?:\.\.\/)+)$/.test(prefix)) throw new Error('Invalid site-relative prefix');
  const current = status.sourceVersion === status.stableVersion;
  const source = status.sourcePublished
    ? `This version is published. Install the exact version with <code>npm install @ponchia/annotations@${escape(status.sourceVersion)}</code>.`
    : 'Publication of this source is not confirmed. Build and pack this checkout for isolated testing; do not expect the stable npm install to implement these APIs.';
  return `<aside data-release-notice data-source-version="${escape(status.sourceVersion)}" data-stable-version="${escape(status.stableVersion)}" aria-label="Documentation version" style="box-sizing:border-box;max-width:100%;padding:12px 20px;margin:0;background:#edf2f4;color:#183540;border-bottom:1px solid #a9b9c0;font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere">
<strong>Docs and demos: ${escape(status.sourceVersion)}${current ? '' : ' — development / preview API'}.</strong>
Stable npm: <strong>${escape(status.stableVersion)}</strong>. ${source}
<a style="color:inherit;text-decoration:underline" href="${escape(status.stableDocs)}">Stable documentation</a> ·
<a style="color:inherit;text-decoration:underline" href="${prefix}docs/migration-0.7.html">0.7 migration guide</a>
</aside>`;
}

export function injectReleaseNotice(html, status, prefix = './') {
  if (html.includes('data-release-notice')) throw new Error('Duplicate publication notice');
  const notice = renderReleaseNotice(status, prefix);
  if (/<main\b[^>]*>/.test(html)) return html.replace(/<main\b[^>]*>/, (tag) => tag + notice);
  if (!/<body\b[^>]*>/.test(html)) throw new Error('Page is missing its body');
  // Client-rendered demos replace their root, not this sibling landmark.
  return html.replace(/<body\b[^>]*>/, (tag) => tag + notice);
}
