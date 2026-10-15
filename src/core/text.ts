type WrapNoteTextOptions = {
  maxChars: number;
  maxLines?: number;
  splitter?: string | RegExp | undefined;
};

// Character budgets mean user-visible grapheme clusters, not UTF-16 code
// units. Always keep combining marks, flags, emoji modifiers and ZWJ sequences
// together. Older runtimes fall back to code points, never half a surrogate.
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;

function graphemes(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : Array.from(text);
}

export function countTextGraphemes(text: string): number {
  return segmenter ? Array.from(segmenter.segment(text)).length : Array.from(text).length;
}

export function wrapNoteText(text: string, options: WrapNoteTextOptions): string[] {
  const maxChars = Math.max(1, Math.floor(options.maxChars));
  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const words = text.split(options.splitter ?? /\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let currentLength = 0;

  for (const word of words) {
    const clusters = graphemes(word);
    if (clusters.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
        currentLength = 0;
      }

      for (let index = 0; index < clusters.length; index += maxChars) {
        lines.push(clusters.slice(index, index + maxChars).join(''));
      }
      continue;
    }

    if (current && currentLength + 1 + clusters.length > maxChars) {
      lines.push(current);
      current = word;
      currentLength = clusters.length;
    } else {
      current = current ? `${current} ${word}` : word;
      currentLength += clusters.length + (currentLength > 0 ? 1 : 0);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}
