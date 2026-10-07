/** Canonicalize attribute order and normalize opaque IDs while preserving duplicates. */
export function normalizeOpaqueIds(xml: string): string {
  const normalizedIds = new Map<string, string>();

  const normalizedXml = xml.replace(/\bid="([^"]+)"/g, (_attribute, id: string) => {
    let normalizedId = normalizedIds.get(id);
    if (!normalizedId) {
      normalizedId = `node-${normalizedIds.size + 1}`;
      normalizedIds.set(id, normalizedId);
    }

    return `id="${normalizedId}"`;
  });

  return normalizedXml.replace(
    /<([A-Za-z_][\w:.-]*)([^<>]*?)>/g,
    (tag, name: string, rawAttrs: string) => {
      const selfClosing = /\/\s*$/.test(rawAttrs);
      const attrText = rawAttrs.replace(/\/\s*$/, '');
      const attributes = [...attrText.matchAll(/\s+([^=\s]+)="([^"]*)"/g)].map(
        (match) => [match[1], match[2]] as const,
      );

      if (attributes.length === 0) return tag;

      attributes.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
      const serializedAttributes = attributes
        .map(([attribute, value]) => `${attribute}="${value}"`)
        .join(' ');

      return `<${name} ${serializedAttributes}${selfClosing ? ' /' : ''}>`;
    },
  );
}
