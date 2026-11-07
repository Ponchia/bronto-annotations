/** Site-only export controls. Recipes stay text; no package serialization API. */
export function setupPlaygroundExports(root: Document = document): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-copy],[data-copy-target]');
  for (const [index, button] of [...buttons].entries()) {
    const originalLabel = button.textContent;
    let operation = 0;
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
    const feedback = root.createElement('div');
    feedback.className = 'copy-feedback';
    const status = root.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const manual = root.createElement('div');
    manual.hidden = true;
    const label = root.createElement('label');
    const input = root.createElement('textarea');
    input.id = `manual-copy-${index}`;
    input.readOnly = true;
    input.rows = 6;
    input.spellcheck = false;
    label.htmlFor = input.id;
    label.textContent = 'Text captured when you clicked — copy manually';
    manual.append(label, input);
    feedback.append(status, manual);
    (button.closest('.scene-source-toolbar, .code-toolbar, .install') ?? button).after(feedback);

    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget;
      const content = targetId
        ? root.getElementById(targetId)?.textContent ?? ''
        : button.dataset.copy ?? '';
      if (!content) return;
      const current = ++operation;
      clearTimeout(feedbackTimer);
      button.textContent = originalLabel;
      manual.hidden = true;
      status.textContent = 'Copying…';
      try {
        const clipboard = root.defaultView?.navigator.clipboard;
        if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
        await clipboard.writeText(content);
        if (current !== operation) return;
        button.textContent = 'Copied';
        status.textContent = 'Copied the text shown when you clicked.';
        feedbackTimer = setTimeout(() => { button.textContent = originalLabel; }, 1500);
      } catch {
        if (current !== operation) return;
        // Keep the clicked bytes even if the live scene changes while a
        // clipboard permission prompt is open. Never select a newer recipe.
        input.value = content;
        input.defaultValue = content; // Native scene reset must retain this snapshot too.
        manual.hidden = false;
        input.focus();
        input.select();
        status.textContent = 'Clipboard unavailable. The text from your click is selected below. Copy it manually.';
      }
    });
  }

  root.getElementById('download-scene-code')?.addEventListener('click', () => {
    const content = root.getElementById('scene-source-code')?.textContent;
    const status = root.getElementById('scene-download-status');
    if (!content || !status) return;
    try {
      // Export exactly the visible recipe, without page URLs or other metadata.
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const link = root.createElement('a');
      link.href = url;
      link.download = 'annotation-scene.ts';
      link.hidden = true;
      root.body.append(link);
      try {
        link.click();
        status.textContent = 'Download requested: annotation-scene.ts. It contains the scene shown when you clicked.';
      } finally {
        link.remove();
        // Let the browser consume the URL before releasing its bytes.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      status.textContent = 'Download unavailable. Use Copy code or select the source below.';
    }
  });
}
