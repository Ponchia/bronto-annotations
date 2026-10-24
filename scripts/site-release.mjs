/** Build-time publication facts; no registry request, cookie or runtime script. */
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Whether text offers the exact install command for one version. A command for a
 * longer version that starts with it (0.7.0 inside 0.7.0-rc.3) does not count.
 */
export function offersInstall(text, version) {
  const command = `npm install @ponchia/annotations@${version}`;
  for (let at = text.indexOf(command); at !== -1; at = text.indexOf(command, at + 1)) {
    const rest = text.slice(at + command.length, at + command.length + 2);
    if (!/^(?:[0-9A-Za-z+-]|\.[0-9A-Za-z])/.test(rest)) return true;
  }
  return false;
}

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
  const identity = current ? 'stable release'
    : status.sourcePublished ? 'published candidate' : 'development source';
  const availableCandidate = status.previewVersion && status.previewVersion !== status.sourceVersion
    ? `Published candidate: <strong>${escape(status.previewVersion)}</strong>. Install it with <code>npm install @ponchia/annotations@${escape(status.previewVersion)}</code>.`
    : '';
  const source = status.sourcePublished
    ? `This version is published. Install the exact version with <code>npm install @ponchia/annotations@${escape(status.sourceVersion)}</code>.`
    : 'Publication of this source is not confirmed. Build and pack this checkout for isolated testing; do not expect the stable npm install to implement these APIs.';
  const candidateDocs = status.previewVersion
    ? `<a data-candidate-docs style="color:inherit;text-decoration:underline" href="https://github.com/Ponchia/bronto-annotations/blob/v${escape(status.previewVersion)}/docs/README.md">Candidate documentation</a> ·`
    : '';
  // Inline presentation travels with independently bundled demos. Native details
  // keeps the version warning useful without a runtime script or registry lookup.
  return `<aside data-release-notice data-source-version="${escape(status.sourceVersion)}" data-stable-version="${escape(status.stableVersion)}" aria-label="Documentation version" style="box-sizing:border-box;max-width:100%;padding:8px 20px;margin:0;background:#edf2f4;color:#183540;border-bottom:1px solid #a9b9c0;font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere">
<div data-release-identity style="display:flex;flex-wrap:wrap;column-gap:20px;row-gap:0">
<span>Docs and demos: <strong>${escape(status.sourceVersion)}</strong> (main · ${identity}).</span>
<span>Stable npm: <strong>${escape(status.stableVersion)}</strong> · <a style="color:inherit;text-decoration:underline" href="${escape(status.stableDocs)}">Stable docs</a>.</span>
</div>
<details style="margin:0;padding:0;border:0;background:transparent">
<summary style="cursor:pointer;min-height:24px;width:fit-content">Install and version details</summary>
<div data-release-guidance style="padding:4px 0 8px">
<p style="margin:4px 0">Stable install: <code>${escape(status.stableInstall)}</code>. The stable documentation matches that package.</p>
<p style="margin:4px 0">${source}</p>
${availableCandidate ? `<p style="margin:4px 0">${availableCandidate}</p>` : ''}
${candidateDocs}
<a style="color:inherit;text-decoration:underline" href="${prefix}docs/migration-0.7.html">0.7 migration guide</a>
</div>
</details>
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
