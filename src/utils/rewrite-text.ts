/**
 * Canonicalize text used in a rewrite request proof.
 *
 * Lexical exposes a single `\n` between selected block nodes, while the Page
 * composer serializes the same quote with a space. Treat only that transport
 * separator as equivalent at the proof boundary; the actual range offsets and
 * replacement operation remain block-local, so this does not broaden the
 * mutation target or hide content edits.
 */
export function normalizeRewriteText(text: string): string {
  return text.replaceAll(/\r\n?/g, '\n').replaceAll('\n', ' ');
}

/** Stable, browser/Node-compatible hash used by rewrite request contracts. */
export function hashRewriteText(text: string): string {
  // Match CollaborativeAgentEditor so request hashes can cross package
  // entrypoints without a crypto dependency.
  let hash = 2_166_136_261;
  for (const character of normalizeRewriteText(text)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
