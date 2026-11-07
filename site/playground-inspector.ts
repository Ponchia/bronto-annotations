import type { Annotation, LayoutQualityReport } from '@ponchia/annotations';

/** Site-only text alternative and diagnostic viewer; no package UI/state API. */
export function updatePlaygroundInspector(
  annotations: readonly Annotation[],
  quality: LayoutQualityReport,
  mode: 'automatic' | 'fixed',
  root: Document = document,
): void {
  const summary = root.getElementById('layout-result-summary');
  const notes = root.getElementById('scene-note-list');
  const findings = root.getElementById('layout-findings');
  const empty = root.getElementById('layout-findings-empty');
  if (!summary || !notes || !findings || !empty) return;

  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of quality.issues) counts[issue.severity]++;
  const countLabel = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
  summary.textContent = `${mode === 'automatic' ? 'Collision-aware' : 'Fixed offsets'}: ` +
    [countLabel(annotations.length, 'note'), countLabel(counts.error, 'error'),
      countLabel(counts.warning, 'warning'), countLabel(counts.info, 'connector notice')].join(' · ');

  const noteItems = root.createDocumentFragment();
  for (const annotation of annotations) {
    const item = root.createElement('li');
    item.dataset.annotationId = annotation.id;
    const title = root.createElement('strong');
    title.textContent = annotation.note?.title || 'Untitled note';
    const identity = root.createElement('small');
    identity.textContent = `ID: ${annotation.id}`;
    item.append(title, identity);
    if (annotation.note?.body) {
      const body = root.createElement('p');
      body.textContent = annotation.note.body;
      item.append(body);
    }
    noteItems.append(item);
  }
  notes.replaceChildren(noteItems);

  const issueItems = root.createDocumentFragment();
  for (const issue of quality.issues) {
    const item = root.createElement('li');
    item.dataset.issueType = issue.type;
    item.dataset.severity = issue.severity;
    // Text nodes preserve untrusted titles/messages without injecting markup.
    item.textContent = `${issue.severity}: ${issue.message}`;
    if (issue.area !== undefined) item.append(` Area: ${Math.round(issue.area)} chart units².`);
    issueItems.append(item);
  }
  findings.replaceChildren(issueItems);
  findings.hidden = quality.issues.length === 0;
  empty.hidden = quality.issues.length !== 0;
}
