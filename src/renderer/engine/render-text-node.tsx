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

export function renderTextNode(node: Record<string, any>, key: string): ReactNode {
  let element: ReactNode = node.text as string;
  const format: number = (node.format as number) || 0;

  for (const [flag, tag] of FORMAT_TAGS) {
    if (format & flag) {
      element = createElement(tag, { key: `${key}-${flag}` }, element);
    }
  }

  if (node.style) {
    element = createElement('span', { key, style: parseCSSText(node.style as string) }, element);
  }

  return element;
}
