import { $isCodeHighlightNode, $isCodeNode } from '@lexical/code';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isLineBreakNode,
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
  PointType,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import {
  SELECT_AFTER_CODEMIRROR_COMMAND,
  SELECT_BEFORE_CODEMIRROR_COMMAND,
} from '@/plugins/codemirror-block';
import { IEditor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

const logger = createDebugLogger('plugin', 'virtual-block');

function resolveElement(
  element: ElementNode,
  isBackward: boolean,
  focusOffset: number,
): LexicalNode | null {
  const parent = element.getParent();
  let offset = focusOffset;
  let block = element;
  if (parent !== null) {
    if (isBackward && focusOffset === 0) {
      offset = block.getIndexWithinParent();
      block = parent;
    } else if (!isBackward && focusOffset === block.getChildrenSize()) {
      offset = block.getIndexWithinParent() + 1;
      block = parent;
    }
  }
  return block.getChildAtIndex(isBackward ? offset - 1 : offset);
}

function isCodeNodeLastLine(focusNode: LexicalNode) {
  if (!$isCodeHighlightNode(focusNode)) {
    return false;
  }
  const codeNode = focusNode.getParent();
  if (!$isCodeNode(codeNode)) {
    return false;
  }
  let last: LexicalNode | null | undefined = codeNode.getLastChild();
  do {
    if ($isLineBreakNode(last)) {
      return false;
    }
    if (last === focusNode) {
      return codeNode;
    }
    last = last?.getPreviousSibling();
  } while (last !== focusNode && last);
  if (last === focusNode) {
    return codeNode;
  }
  return false;
}

export function toRootElement(node: LexicalNode): ElementNode {
  let currentNode: LexicalNode | null = node;
  let parent = currentNode.getParent();
  while (parent !== null && !$isRootOrShadowRoot(parent)) {
    currentNode = parent;
    parent = currentNode.getParent();
  }
  return currentNode as ElementNode;
}

export function $getAdjacentNode(focus: PointType, isBackward: boolean): null | LexicalNode {
  const focusOffset = focus.offset;
  if (focus.type === 'element') {
    const block = focus.getNode();
    return resolveElement(block, isBackward, focusOffset);
  } else {
    const focusNode = focus.getNode();
    if (
      (isBackward && focusOffset === 0) ||
      (!isBackward && focusOffset === focusNode.getTextContentSize())
    ) {
      const possibleNode = isBackward ? focusNode.getPreviousSibling() : focusNode.getNextSibling();
      if (possibleNode === null) {
        return resolveElement(
          focusNode.getParentOrThrow(),
          isBackward,
          focusNode.getIndexWithinParent() + (isBackward ? 0 : 1),
        );
      }
      return possibleNode;
    } else if (!isBackward && isCodeNodeLastLine(focusNode)) {
      return focusNode.getParent()?.getNextSibling() || null;
    }
  }
  return null;
}

export function $getDownUpNode(focus: PointType, isUp: boolean): null | LexicalNode {
  const focusNode = focus.getNode();
  let blockParent: LexicalNode | null = focusNode;
  while (blockParent !== null && blockParent.isInline()) {
    blockParent = blockParent.getParent();
  }
  if (!blockParent) {
    return null;
  }
  let nextNode = isUp ? blockParent.getPreviousSibling() : blockParent.getNextSibling();
  while (!nextNode && !$isRootOrShadowRoot(blockParent)) {
    blockParent = blockParent.getParent();
    if (!blockParent) {
      return null;
    }
    nextNode = isUp ? blockParent.getPreviousSibling() : blockParent.getNextSibling();
  }
  if (!nextNode) {
    return null;
  }
  return nextNode;
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
    } else if (!$isEmptyNode(child as ElementNode)) {
      return false;
    }
  }
  return true;
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
          if ($getRoot().getFirstChild() === possibleNode) {
            event.preventDefault();
            const p = $createParagraphNode();
            possibleNode.insertBefore(p);
            needRemoveOnFocusNode = p;
            p.selectStart();
            return true;
          } else if ($isDecoratorNode(possibleNode.getPreviousSibling())) {
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
          const focusNode = selection.focus.getNode();
          const possibleNode = toRootElement(focusNode);
          if (possibleNode === needRemoveOnFocusNode || $isEmptyNode(possibleNode)) {
            return false;
          }
          const root = $getRoot();
          if (root.getLastChild() === possibleNode) {
            event.preventDefault();
            const p = $createParagraphNode();
            possibleNode.insertAfter(p);
            needRemoveOnFocusNode = p;
            p.selectStart();
          }
          return true;
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
