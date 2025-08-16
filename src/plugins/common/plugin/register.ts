import { $isHeadingNode } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  LexicalEditor,
  LexicalNode,
  PointType,
  RangeSelection,
  isModifierMatch,
} from 'lexical';

import { CONTROL_OR_META, CONTROL_OR_META_AND_SHIFT } from '@/common/sys';

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
    }
  }
  return null;
}

function $isSelectionAtEndOfRoot(selection: RangeSelection) {
  const focus = selection.focus;
  return focus.key === 'root' && focus.offset === $getRoot().getChildrenSize();
}

export function registerHeaderBackspace(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_BACKSPACE_COMMAND,
    (payload) => {
      // Handle backspace key press
      const headingNode = editor.read(() => {
        const selection = $getSelection();
        // 非单点光标不处理
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const anchor = selection.anchor;
        if (anchor.offset !== 0) {
          return false;
        }
        const anchorNode = anchor.getNode();
        if ($isTextNode(anchorNode)) {
          // 非最前面的文本节点不处理
          if (anchorNode.getPreviousSibling()) {
            return false;
          }
          const parent = anchorNode.getParentOrThrow();
          if (!$isHeadingNode(parent)) {
            return false;
          }
          return parent;
        }
        if ($isHeadingNode(anchorNode)) {
          return anchorNode;
        }
        return false;
      });

      if (headingNode) {
        payload.stopImmediatePropagation();
        payload.preventDefault();
        payload.stopPropagation();

        editor.update(() => {
          const node = $createParagraphNode();
          headingNode.replace(node, true);
          node.select(0, 0);
        });
        return true;
      }
      return false;
    },
    COMMAND_PRIORITY_NORMAL,
  );
}

export function registerRichKeydown(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      KEY_DOWN_COMMAND,
      (payload) => {
        // ctrl + shift + x
        if (isModifierMatch(payload, CONTROL_OR_META_AND_SHIFT) && payload.code === 'KeyX') {
          // Handle the custom key combination
          payload.stopImmediatePropagation();
          payload.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
          return true;
        }
        // ctrl + e
        if (isModifierMatch(payload, CONTROL_OR_META) && payload.code === 'KeyE') {
          payload.stopImmediatePropagation();
          payload.preventDefault();
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            nodes[0].selectPrevious();
            event.preventDefault();
            return true;
          }
        } else if ($isRangeSelection(selection)) {
          const possibleNode = $getAdjacentNode(selection.focus, true);
          if (!event.shiftKey && $isDecoratorNode(possibleNode)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(possibleNode.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            nodes[0].selectNext(0, 0);
            event.preventDefault();
            return true;
          }
        } else if ($isRangeSelection(selection)) {
          if ($isSelectionAtEndOfRoot(selection)) {
            event.preventDefault();
            return true;
          }
          const possibleNode = $getAdjacentNode(selection.focus, false);
          if (!event.shiftKey && $isDecoratorNode(possibleNode)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(possibleNode.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    ),
  );
}
