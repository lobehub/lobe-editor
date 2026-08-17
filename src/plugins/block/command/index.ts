import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
  type ListNode,
} from '@lexical/list';
import {
  $createParagraphNode,
  $getNodeByKey,
  $isParagraphNode,
  $isRootNode,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

import {
  COLLAPSIBLE_NODE_TYPE,
  isRootLevelLayoutBlock,
  isTableDescendant,
  TABLE_NODE_TYPE,
} from '../layout-policy';

export interface BlockMovePayload {
  placement: 'after' | 'before';
  sourceBlockId: string;
  targetBlockId: string;
}

export const MOVE_BLOCK_COMMAND = createCommand<BlockMovePayload>('MOVE_BLOCK_COMMAND');
const logger = createDebugLogger('plugin', 'block-command');

const getListParent = (node: LexicalNode | null): ListNode | null => {
  if (!node) return null;
  const parent = node.getParent();
  return $isListNode(parent) ? parent : null;
};

const getTopListContextFromItem = (item: ListItemNode) => {
  let currentItem = item;
  let currentList = getListParent(item);

  while (currentList && $isListItemNode(currentList.getParent())) {
    currentItem = currentList.getParent() as ListItemNode;
    currentList = getListParent(currentItem);
  }

  return {
    item: currentItem,
    list: currentList,
  };
};

const cloneListTail = (
  listNode: ListNode,
  tailStart: LexicalNode | null,
  fallbackStartValue: number,
): ListNode | null => {
  if (!tailStart) return null;

  const newListNode = $createListNode(listNode.getListType(), fallbackStartValue);
  let current: LexicalNode | null = tailStart;

  while (current) {
    const nextSibling: LexicalNode | null = current.getNextSibling();
    current.remove();
    newListNode.append(current);
    current = nextSibling;
  }

  return newListNode;
};

const alignListItemDepth = (item: ListItemNode, target: ListItemNode) => {
  const targetWithIndent = target as ListItemNode & {
    getIndent?: () => number;
  };
  const itemWithIndent = item as ListItemNode & {
    setIndent?: (indent: number) => void;
  };

  if (
    typeof targetWithIndent.getIndent === 'function' &&
    typeof itemWithIndent.setIndent === 'function'
  ) {
    itemWithIndent.setIndent(targetWithIndent.getIndent());
  }
};

const cleanupEmptyListForItem = (listItem: ListItemNode) => {
  const parentList = getListParent(listItem);
  if (parentList && parentList.getChildrenSize() === 0) {
    parentList.remove();
  }
};

const getAncestorOfType = (node: LexicalNode, type: string): LexicalNode | null => {
  let parent = node.getParent();

  while (parent) {
    if (parent.getType() === type) {
      return parent;
    }

    parent = parent.getParent();
  }

  return null;
};

const getOutermostLayoutAncestor = (node: LexicalNode): LexicalNode | null => {
  let parent = node.getParent();
  let layoutAncestor: LexicalNode | null = null;

  while (parent) {
    if (isRootLevelLayoutBlock(parent)) {
      layoutAncestor = parent;
    }

    parent = parent.getParent();
  }

  return layoutAncestor;
};

const getCollapsibleTitleParent = (node: LexicalNode): LexicalNode | null => {
  const parent = node.getParent();

  if (parent?.getType() !== COLLAPSIBLE_NODE_TYPE) {
    return null;
  }

  return parent.getFirstChild()?.is(node) ? parent : null;
};

const isDescendantOf = (node: LexicalNode, ancestor: LexicalNode): boolean => {
  let parent = node.getParent();

  while (parent) {
    if (parent.is(ancestor)) {
      return true;
    }

    parent = parent.getParent();
  }

  return false;
};

const moveBlockNode = (payload: BlockMovePayload): boolean => {
  logger.debug('start', payload);

  const sourceNode = $getNodeByKey(payload.sourceBlockId);
  const requestedTargetNode = $getNodeByKey(payload.targetBlockId);

  if (!sourceNode || !requestedTargetNode) {
    logger.debug('abort: node-not-found', {
      sourceFound: Boolean(sourceNode),
      targetFound: Boolean(requestedTargetNode),
    });
    return false;
  }

  if (sourceNode.is(requestedTargetNode)) {
    logger.debug('abort: source-equals-target');
    return false;
  }

  if (isDescendantOf(requestedTargetNode, sourceNode)) {
    logger.debug('abort: target-inside-source');
    return false;
  }

  if (!isRootLevelLayoutBlock(sourceNode) && isTableDescendant(sourceNode)) {
    logger.debug('abort: table-descendant-source', { sourceType: sourceNode.getType() });
    return false;
  }

  const targetNode = isRootLevelLayoutBlock(sourceNode)
    ? getOutermostLayoutAncestor(requestedTargetNode) || requestedTargetNode
    : getCollapsibleTitleParent(requestedTargetNode) ||
      getAncestorOfType(requestedTargetNode, TABLE_NODE_TYPE) ||
      requestedTargetNode;

  if (!targetNode.is(requestedTargetNode)) {
    logger.debug('promote: outside-layout-block', {
      requestedTargetType: requestedTargetNode.getType(),
      targetType: targetNode.getType(),
    });
  }

  if (!$isListItemNode(targetNode)) {
    const sourceIsListItem = $isListItemNode(sourceNode);
    let movingNode: LexicalNode = sourceNode;

    logger.debug('branch: normal-block-target', {
      placement: payload.placement,
      targetType: targetNode.getType(),
    });

    if (sourceIsListItem) {
      const sourceListItem = sourceNode;
      const paragraphNode = $createParagraphNode();
      paragraphNode.append(...sourceListItem.getChildren());
      sourceListItem.remove();
      cleanupEmptyListForItem(sourceListItem);
      movingNode = paragraphNode;

      logger.debug('convert: listItem-to-paragraph', {
        sourceType: sourceNode.getType(),
      });
    }

    if (payload.placement === 'before') {
      targetNode.insertBefore(movingNode);
    } else {
      targetNode.insertAfter(movingNode);
    }

    logger.debug('done: normal-block-target');
    return true;
  }

  const targetListItem = targetNode;
  const sourceIsListItem = $isListItemNode(sourceNode);
  const sourceIsParagraph = $isParagraphNode(sourceNode);

  if (sourceIsListItem || sourceIsParagraph) {
    logger.debug('branch: list-insert-with-item-or-paragraph', {
      sourceIsListItem,
      sourceIsParagraph,
      targetType: targetListItem.getType(),
    });

    let movingListItem: ListItemNode;

    if (sourceIsListItem) {
      movingListItem = sourceNode;
    } else {
      const sourceParagraph = sourceNode;
      const targetListParent = getListParent(targetListItem);
      const targetListType = targetListParent?.getListType();
      const targetChecked = (
        targetListItem as ListItemNode & { getChecked?: () => boolean }
      ).getChecked?.();

      const newListItem = $createListItemNode(
        targetListType === 'check' ? targetChecked : undefined,
      );
      (newListItem as ElementNode).append(...(sourceParagraph as ElementNode).getChildren());
      sourceParagraph.remove();
      movingListItem = newListItem;
    }

    alignListItemDepth(movingListItem, targetListItem);

    if (payload.placement === 'before') {
      targetListItem.insertBefore(movingListItem);
    } else {
      targetListItem.insertAfter(movingListItem);
    }

    logger.debug('done: list-insert-with-item-or-paragraph');

    return true;
  }

  const topContext = getTopListContextFromItem(targetListItem);
  const topListNode = topContext.list;
  const topListItem = topContext.item;

  if (!topListNode) {
    logger.debug('branch: list-target-without-top-list', { placement: payload.placement });

    if (payload.placement === 'before') {
      targetListItem.insertBefore(sourceNode);
    } else {
      targetListItem.insertAfter(sourceNode);
    }

    logger.debug('done: list-target-without-top-list');
    return true;
  }

  const tailStart = payload.placement === 'before' ? topListItem : topListItem.getNextSibling();

  // Inserting non-list blocks into a list boundary: split into [topListHead] [source] [newTailList].
  if (tailStart === topListItem && topListItem.getPreviousSibling() === null) {
    logger.debug('branch: split-list-head-insert-before-list');
    topListNode.insertBefore(sourceNode);
    logger.debug('done: split-list-head-insert-before-list');
    return true;
  }

  if (!tailStart) {
    logger.debug('branch: split-list-tail-insert-after-list');
    topListNode.insertAfter(sourceNode);
    logger.debug('done: split-list-tail-insert-after-list');
    return true;
  }

  const listStartValue =
    $isListItemNode(tailStart) && typeof tailStart.getValue === 'function'
      ? tailStart.getValue()
      : 1;
  const newTailList = cloneListTail(topListNode, tailStart, listStartValue);
  logger.debug('branch: split-list-middle', {
    hasNewTailList: Boolean(newTailList),
    listStartValue,
    tailStartType: tailStart.getType(),
  });

  topListNode.insertAfter(sourceNode);

  if (newTailList) {
    sourceNode.insertAfter(newTailList);
  }

  if (topListNode.getChildrenSize() === 0) {
    topListNode.remove();
  }

  if (!$isRootNode(sourceNode.getParent())) {
    const parent = sourceNode.getParent();
    if (parent && !$isRootNode(parent) && $isListItemNode(parent)) {
      const parentList = getListParent(parent);
      if (parentList && parentList.getChildrenSize() === 0) {
        parentList.remove();
      }
    }
  }

  logger.debug('done: split-list-middle');
  return true;
};

export function registerBlockMoveCommand(editor: LexicalEditor) {
  const unregister = editor.registerCommand(
    MOVE_BLOCK_COMMAND,
    (payload) => {
      logger.debug('received-command', payload);
      return moveBlockNode(payload);
    },
    COMMAND_PRIORITY_EDITOR,
  );

  return () => {
    unregister();
  };
}
