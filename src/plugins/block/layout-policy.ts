import type { LexicalNode } from 'lexical';

export const COLLAPSIBLE_NODE_TYPE = 'collapsible';
export const TABLE_NODE_TYPE = 'table';

const ROOT_LEVEL_LAYOUT_BLOCK_TYPES = new Set([COLLAPSIBLE_NODE_TYPE, TABLE_NODE_TYPE]);

export const isRootLevelLayoutBlock = (node: LexicalNode): boolean => {
  return ROOT_LEVEL_LAYOUT_BLOCK_TYPES.has(node.getType());
};

export const isTableDescendant = (node: LexicalNode): boolean => {
  let parent = node.getParent();

  while (parent) {
    if (parent.getType() === TABLE_NODE_TYPE) {
      return true;
    }

    parent = parent.getParent();
  }

  return false;
};
