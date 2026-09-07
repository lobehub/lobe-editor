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

/**
 * Return the text projection of a serialized Lexical node tree.
 *
 * This intentionally follows the AI-session projection contract: generated
 * ranges are collected from text nodes and concatenated, so structural
 * Markdown syntax (list markers, emphasis delimiters, and code fences) is not
 * part of the value.  The parser remains owned by the Markdown plugin; this
 * helper only projects its already-parsed node tree.
 */
export function getSerializedTextContent(node: unknown, seen = new WeakSet<object>()): string {
  if (typeof node !== 'object' || node === null) return '';
  if (seen.has(node)) return '';
  seen.add(node);

  if (Array.isArray(node)) return node.map((child) => getSerializedTextContent(child, seen)).join('');

  const record = node as { children?: unknown; text?: unknown; type?: unknown };
  if (record.type === 'cursor') return '';
  if (typeof record.text === 'string') return record.text;
  return getSerializedTextContent(record.children, seen);
}

/**
 * Canonical text used by continuation checks for Markdown model output.
 * Callers provide the editor-owned Markdown parser so this utility never
 * reimplements Markdown syntax or treats adapter-owned source as rich text.
 */
export function canonicalizeMarkdownRewriteText(
  markdown: string,
  parseMarkdown: (markdown: string) => unknown,
): string {
  return getSerializedTextContent(parseMarkdown(markdown));
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
