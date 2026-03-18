import type { ElementNode, LexicalNode } from 'lexical';
import { $isElementNode, $isTextNode } from 'lexical';
import type { ReactNode } from 'react';

import type { NodeRenderer, RendererRegistry } from '../types';
import { renderBuiltinNode } from './render-builtin-node';
import { renderTextNode } from './render-text-node';

export function renderNode(
  node: LexicalNode,
  registry: RendererRegistry,
  headingSlugs: Map<string, number>,
  overrides: Record<string, NodeRenderer> | undefined,
  key: string,
): ReactNode {
  const type = node.getType();

  // CursorNode extends TextNode but should be suppressed in renderer output
  if (type === 'cursor') {
    return null;
  }

  if ($isTextNode(node)) {
    const serialized = node.exportJSON();
    return renderTextNode(serialized, key);
  }

  const serialized = node.exportJSON();

  let children: ReactNode[] | null = null;
  if ($isElementNode(node)) {
    const childNodes = (node as ElementNode).getChildren();
    if (childNodes.length > 0) {
      children = childNodes.map((child, i) =>
        renderNode(child, registry, headingSlugs, overrides, `${key}-${i}`),
      );
    }
  }

  const textContent = node.getTextContent ? node.getTextContent() : undefined;

  const override = overrides?.[type];
  if (override) {
    return override(serialized, key, children);
  }

  const renderer = registry.get(type);
  if (renderer) {
    return renderer(serialized, key, children);
  }

  return renderBuiltinNode(serialized, key, children, headingSlugs, textContent);
}
