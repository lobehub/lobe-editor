export interface EmbeddedTextChange {
  from: number;
  insert: string;
  to: number;
}

const isHighSurrogate = (value: number): boolean => value >= 0xD800 && value <= 0xDBFF;

export const computeEmbeddedTextChange = (
  previous: string,
  next: string,
): EmbeddedTextChange | null => {
  if (previous === next) return null;
  let from = 0;
  while (from < previous.length && from < next.length && previous[from] === next[from]) from += 1;
  // Never cut a UTF-16 surrogate pair in half. LoroText and CodeMirror both
  // use JavaScript UTF-16 offsets, but the edit itself must still contain a
  // complete scalar value.
  if (from > 0 && isHighSurrogate(previous.charCodeAt(from - 1))) from -= 1;

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > from && nextEnd > from && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  if (
    previousEnd > from &&
    previousEnd < previous.length &&
    isHighSurrogate(previous.charCodeAt(previousEnd - 1))
  ) {
    // The suffix matcher consumed only the shared low surrogate while the
    // high surrogates differ. Undo that suffix match completely so insertion
    // and deletion stay on scalar boundaries.
    previousEnd += 1;
    nextEnd += 1;
  }
  return {
    from,
    insert: next.slice(from, nextEnd),
    to: previousEnd,
  };
};
