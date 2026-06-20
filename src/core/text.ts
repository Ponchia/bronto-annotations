type WrapNoteTextOptions = {
  maxChars: number;
  maxLines?: number;
  splitter?: string | RegExp | undefined;
};

export function wrapNoteText(text: string, options: WrapNoteTextOptions): string[] {
  const maxChars = Math.max(1, Math.floor(options.maxChars));
  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const words = text.split(options.splitter ?? /\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }

      continue;
    }

    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}
