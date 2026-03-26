import { type ReactNode, createElement } from 'react';

import { parseCSSText } from './utils';

const FORMAT_TAGS: [number, string][] = [
  [1, 'strong'],
  [2, 'em'],
  [4, 's'],
  [8, 'u'],
  [16, 'code'],
  [32, 'sub'],
  [64, 'sup'],
  [128, 'mark'],
];

function shouldPreserveWhitespace(text: string): boolean {
  return /[\t\n]| {2,}|^ | $/.test(text);
}

export function renderTextNode(node: Record<string, any>, key: string): ReactNode {
  const style = node.style ? parseCSSText(node.style as string) : undefined;
  const preserveWhitespace = shouldPreserveWhitespace(node.text as string);
  let element: ReactNode = node.text as string;
  const format: number = (node.format as number) || 0;

  for (const [flag, tag] of FORMAT_TAGS) {
    if (format & flag) {
      element = createElement(tag, { key: `${key}-${flag}` }, element);
    }
  }

  if (style || preserveWhitespace) {
    element = createElement(
      'span',
      {
        key,
        style: {
          ...style,
          ...(preserveWhitespace ? { whiteSpace: 'break-spaces' as const } : undefined),
        },
      },
      element,
    );
  }

  return element;
}
