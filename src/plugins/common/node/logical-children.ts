import type { LexicalNode } from 'lexical';
import { $isElementNode } from 'lexical';

import { $isHoleNode } from './hole';

/**
 * Return the children represented by a node in the logical document tree.
 *
 * A Hole and its boundary cursor markers are runtime structure. A Hole
 * therefore contributes its payload children directly, and nested Holes are
 * transparent as well. Keeping this traversal here makes path based consumers
 * agree about multi-payload Holes without importing a plugin barrel or editor
 * kernel.
 */
export const $getLogicalChildren = (node: LexicalNode): LexicalNode[] => {
  const children = $isHoleNode(node)
    ? node.getContentChildren()
    : $isElementNode(node)
      ? node.getChildren()
      : [];

  return children.flatMap((child) => ($isHoleNode(child) ? $getLogicalChildren(child) : [child]));
};
