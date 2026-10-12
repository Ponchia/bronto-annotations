/**
 * Host-owned selection event normalization for the interactive React example.
 *
 * Only visible/focusable note content selects text for editing. Connector
 * paths, editing handles, arbitrary SVG subjects and elements outside this
 * stage cannot hijack the text editor's selected annotation.
 */
export function noteIdFromCanvasTarget(
  target: EventTarget | null, stage: HTMLElement
): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const note = target.closest('.pa-annotation__note-box[role="note"][data-annotation-id]');
  if (!note || !stage.contains(note)) return undefined;
  return note.getAttribute('data-annotation-id') ?? undefined;
}
