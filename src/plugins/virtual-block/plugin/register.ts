import { $isListItemNode, $isListNode } from '@lexical/list';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  ElementNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
  LexicalNode,
  ParagraphNode,
  RangeSelection,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import {
  SELECT_AFTER_CODEMIRROR_COMMAND,
  SELECT_BEFORE_CODEMIRROR_COMMAND,
} from '@/plugins/codemirror-block';
import { IEditor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

const logger = createDebugLogger('plugin', 'virtual-block');

export function toRootElement(node: LexicalNode): ElementNode {
  let currentNode: LexicalNode | null = node;
  let parent = currentNode.getParent();
  while (parent !== null && !$isRootOrShadowRoot(parent)) {
    currentNode = parent;
    parent = currentNode.getParent();
  }
  return currentNode as ElementNode;
}

function $isEmptyNode(node: ElementNode): boolean {
  if (node.getChildrenSize() === 0) {
    return true;
  }
  for (const child of node.getChildren()) {
    if ($isTextNode(child)) {
      if (child.getTextContent().trim().length > 0) {
        return false;
      }
    } else if ($isElementNode(child)) {
      if (!$isEmptyNode(child)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

function $getTopLevelListItem(selection: RangeSelection) {
  const focusNode = selection.focus.getNode();
  const listNode = toRootElement(focusNode);

  if (!$isListNode(listNode)) {
    return null;
  }

  let current: LexicalNode = focusNode;
  while (current.getParent() !== listNode) {
    const parent = current.getParent();
    if (!parent || $isRootOrShadowRoot(parent)) {
      return null;
    }
    current = parent;
  }

  if (!$isListItemNode(current)) {
    return null;
  }

  return {
    listItem: current,
    listNode,
  };
}

function $isListBoundarySelection(selection: RangeSelection, isBackward: boolean) {
  if (!selection.isCollapsed()) {
    return false;
  }

  const focusNode = selection.focus.getNode();
  if ($isListNode(focusNode)) {
    return isBackward
      ? selection.focus.offset === 0
      : selection.focus.offset === focusNode.getChildrenSize();
  }

  // Element selections can also focus a ListItemNode, so normalize back to the
  // containing top-level list item before checking whether the list has room to move.
  const listContext = $getTopLevelListItem(selection);
  if (!listContext) {
    return false;
  }

  const { listItem } = listContext;
  return isBackward ? !listItem.getPreviousSibling() : !listItem.getNextSibling();
}

export function registerRichKeydown(editor: LexicalEditor, kernel: IEditor) {
  let needRemoveOnFocusNode: ElementNode | null = null;

  return mergeRegister(
    editor.registerUpdateListener((payload) => {
      const { mutatedNodes } = payload;
      if (needRemoveOnFocusNode) {
        if (mutatedNodes?.get(ParagraphNode)?.get(needRemoveOnFocusNode.getKey()) === 'destroyed') {
          console.info('Virtual block node was removed externally', needRemoveOnFocusNode);
          needRemoveOnFocusNode = null;
          return;
        }
        editor.update(() => {
          try {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const focusNode = selection.focus.getNode();
              if (
                needRemoveOnFocusNode &&
                !$closest(focusNode, (node) => node === needRemoveOnFocusNode)
              ) {
                if ($isEmptyNode(needRemoveOnFocusNode)) {
                  logger.info(
                    'Removing virtual block node after focus moved away',
                    needRemoveOnFocusNode,
                  );
                  needRemoveOnFocusNode?.remove();
                  needRemoveOnFocusNode = null;
                } else {
                  needRemoveOnFocusNode = null;
                }
                return;
              }
            } else if ($isNodeSelection(selection) && needRemoveOnFocusNode) {
              if ($isEmptyNode(needRemoveOnFocusNode)) {
                needRemoveOnFocusNode?.remove();
                needRemoveOnFocusNode = null;
              } else {
                needRemoveOnFocusNode = null;
              }
              return;
            }
          } catch (error) {
            console.error('Error during virtual block cleanup', error);
          }
        });
      }
    }),
    kernel.registerHighCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (event.shiftKey) {
          return false;
        }
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            const elementNode = toRootElement(nodes[0]);
            event.preventDefault();
            const p = $createParagraphNode();
            needRemoveOnFocusNode = p;
            elementNode.insertBefore(p);
            p.selectEnd();
            return true;
          }
        } else if ($isRangeSelection(selection)) {
          const possibleNode = toRootElement(selection.focus.getNode());
          if (possibleNode === needRemoveOnFocusNode || $isEmptyNode(possibleNode)) {
            return false;
          }
          if ($isListNode(possibleNode) && !$isListBoundarySelection(selection, true)) {
            return false;
          }
          if (
            $getRoot().getFirstChild() === possibleNode ||
            $isDecoratorNode(possibleNode.getPreviousSibling())
          ) {
            event.preventDefault();
            const p = $createParagraphNode();
            possibleNode.insertBefore(p);
            needRemoveOnFocusNode = p;
            p.selectStart();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
    kernel.registerHighCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            const node = nodes[0];
            const blockNode = toRootElement(node);
            event.preventDefault();
            const p = $createParagraphNode();
            needRemoveOnFocusNode = p;
            blockNode.insertAfter(p);
            p.selectStart();
            return true;
          }
        } else if ($isRangeSelection(selection)) {
          if (!selection.isCollapsed()) {
            return false;
          }
          const possibleNode = toRootElement(selection.focus.getNode());
          if (possibleNode === needRemoveOnFocusNode || $isEmptyNode(possibleNode)) {
            return false;
          }
          if ($isListNode(possibleNode) && !$isListBoundarySelection(selection, false)) {
            return false;
          }
          if ($getRoot().getLastChild() === possibleNode) {
            event.preventDefault();
            const p = $createParagraphNode();
            possibleNode.insertAfter(p);
            needRemoveOnFocusNode = p;
            p.selectStart();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
    editor.registerCommand(
      SELECT_BEFORE_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          if (!node) {
            return;
          }
          const p = $createParagraphNode();
          needRemoveOnFocusNode = p;
          node.insertBefore(p);
          p.selectEnd();
          editor.focus();
          return true;
        });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
    editor.registerCommand(
      SELECT_AFTER_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          if (!node) {
            return;
          }
          const p = $createParagraphNode();
          needRemoveOnFocusNode = p;
          node.insertAfter(p);
          p.selectEnd();
          editor.focus();
          return true;
        });
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
  );
}
