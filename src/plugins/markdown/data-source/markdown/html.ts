export const selfClosingHtmlTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Split sibling HTML elements without treating nested elements as siblings. */
export function splitHtmlBlock(value: string): Array<{ html: boolean; value: string }> {
  const tags = [
    ...value.matchAll(/<!--[\s\S]*?-->|<\/?[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi),
  ];
  const pairs = new Map<number, number>();
  const stack: Array<{ index: number; name: string }> = [];

  tags.forEach((tag, index) => {
    const name = tag[0].match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();
    if (!name || selfClosingHtmlTags.has(name) || tag[0].endsWith('/>')) return;
    if (tag[0].startsWith('</')) {
      if (stack.at(-1)?.name === name) pairs.set(stack.pop()!.index, index);
    } else {
      stack.push({ index, name });
    }
  });

  const parts: Array<{ html: boolean; value: string }> = [];
  let offset = 0;
  for (let index = 0; index < tags.length; index++) {
    const tag = tags[index];
    if (tag.index > offset) parts.push({ html: false, value: value.slice(offset, tag.index) });
    const end = tags[pairs.get(index) ?? index];
    offset = end.index + end[0].length;
    parts.push({ html: true, value: value.slice(tag.index, offset) });
    index = pairs.get(index) ?? index;
  }
  if (offset < value.length) parts.push({ html: false, value: value.slice(offset) });
  return parts;
}
