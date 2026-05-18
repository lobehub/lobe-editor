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
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  createCommand,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

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

const moveBlockNode = (payload: BlockMovePayload) => {
  logger.debug('start', payload);

  const sourceNode = $getNodeByKey(payload.sourceBlockId);
  const targetNode = $getNodeByKey(payload.targetBlockId);

  if (!sourceNode || !targetNode) {
    logger.debug('abort: node-not-found', {
      sourceFound: Boolean(sourceNode),
      targetFound: Boolean(targetNode),
    });
    return;
  }

  if (sourceNode === targetNode) {
    logger.debug('abort: source-equals-target');
    return;
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
    return;
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

    return;
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
    return;
  }

  const tailStart = payload.placement === 'before' ? topListItem : topListItem.getNextSibling();

  // Inserting non-list blocks into a list boundary: split into [topListHead] [source] [newTailList].
  if (tailStart === topListItem && topListItem.getPreviousSibling() === null) {
    logger.debug('branch: split-list-head-insert-before-list');
    topListNode.insertBefore(sourceNode);
    logger.debug('done: split-list-head-insert-before-list');
    return;
  }

  if (!tailStart) {
    logger.debug('branch: split-list-tail-insert-after-list');
    topListNode.insertAfter(sourceNode);
    logger.debug('done: split-list-tail-insert-after-list');
    return;
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
};

export function registerBlockMoveCommand(editor: LexicalEditor) {
  const unregister = editor.registerCommand(
    MOVE_BLOCK_COMMAND,
    (payload) => {
      logger.debug('received-command', payload);
      moveBlockNode(payload);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  return () => {
    unregister();
  };
}
