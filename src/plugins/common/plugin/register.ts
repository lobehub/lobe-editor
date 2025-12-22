import { $isCodeHighlightNode, $isCodeNode } from '@lexical/code';
import { $isHeadingNode, QuoteNode } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  LexicalEditor,
  LexicalNode,
  PointType,
  REDO_COMMAND,
  RangeSelection,
  UNDO_COMMAND,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import { IEditor } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

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

function $isSelectionAtEndOfRoot(selection: RangeSelection) {
  const focus = selection.focus;
  return focus.key === 'root' && focus.offset === $getRoot().getChildrenSize();
}

export function registerHeaderBackspace(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_BACKSPACE_COMMAND,
    (payload) => {
      // Handle backspace key press for heading nodes
      const headingNode = editor.getEditorState().read(() => {
        const selection = $getSelection();
        // Do not handle non-collapsed selection
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const anchor = selection.anchor;
        if (anchor.offset !== 0) {
          return false;
        }
        const anchorNode = anchor.getNode();
        if ($isTextNode(anchorNode)) {
          // Do not handle non-leading text nodes
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

export interface RichKeydownOptions {
  enableHotkey?: boolean;
}

export function registerRichKeydown(
  editor: LexicalEditor,
  kernel: IEditor,
  options?: RichKeydownOptions,
) {
  const { enableHotkey = true } = options || {};

  return mergeRegister(
    kernel.registerHotkey(
      HotkeyEnum.PasteAsPlainText,
      async () => {
        try {
          const text = await navigator.clipboard.readText();

          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            // Simply insert the plain text
            selection.insertText(text);
          });
        } catch (error) {
          console.error('Failed to paste as plain text:', error);
        }
      },
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopPropagation: true,
      },
    ),
    kernel.registerHotkey(
      HotkeyEnum.Bold,
      () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
    kernel.registerHotkey(
      HotkeyEnum.Italic,
      () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
    kernel.registerHotkey(
      HotkeyEnum.Underline,
      () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
    kernel.registerHotkey(
      HotkeyEnum.Strikethrough,
      () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
    kernel.registerHotkey(HotkeyEnum.Undo, () => editor.dispatchCommand(UNDO_COMMAND, undefined), {
      enabled: enableHotkey,
      preventDefault: true,
      stopImmediatePropagation: true,
    }),
    kernel.registerHotkey(HotkeyEnum.Redo, () => editor.dispatchCommand(REDO_COMMAND, undefined), {
      enabled: enableHotkey,
      preventDefault: true,
      stopImmediatePropagation: true,
    }),
    kernel.registerHighCommand(
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
          const upblock = possibleNode || $getDownUpNode(selection.focus, true);
          if (!event.shiftKey && $isDecoratorNode(possibleNode)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(possibleNode.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          } else if (!event.shiftKey && $isDecoratorNode(upblock)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(upblock.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          } else if (possibleNode && possibleNode.getType() !== 'linebreak') {
            possibleNode?.selectEnd();
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    kernel.registerHighCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          if (!selection.isCollapsed()) {
            return false;
          }
          const focusNode = selection.focus.getNode();
          const quotaNode = $closest(
            focusNode,
            (node) => node.getType() === QuoteNode.getType(),
          ) as QuoteNode | null;
          if (!quotaNode) {
            return false;
          }

          if (quotaNode.getNextSibling()) {
            return false;
          }

          const lastChild = quotaNode.getLastChild();
          if (!lastChild) {
            return false;
          }
          if (!$closest(focusNode, (node) => node === lastChild)) {
            return false;
          }
          event.preventDefault();
          editor.update(() => {
            const paragraph = $createParagraphNode();
            quotaNode.insertAfter(paragraph);
            paragraph.select();
          });
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
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
            const node = nodes[0].getNextSibling();
            if ($isRootOrShadowRoot(node)) {
              const parent = node.getParent();
              if (parent) {
                const index = node.getIndexWithinParent();
                parent.select(index, index);
                event.preventDefault();
                return true;
              }
            }
            node?.selectStart();
            // nodes[0].selectNext(0, 0);
            event.preventDefault();
            return true;
          }
        } else if ($isRangeSelection(selection)) {
          if ($isSelectionAtEndOfRoot(selection)) {
            event.preventDefault();
            return true;
          }
          const possibleNode = $getAdjacentNode(selection.focus, false);
          const upblock = possibleNode || $getDownUpNode(selection.focus, false);
          if (!event.shiftKey && $isDecoratorNode(possibleNode)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(possibleNode.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          } else if (!event.shiftKey && $isDecoratorNode(upblock)) {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(upblock.getKey());
            editor.update(() => {
              $setSelection(nodeSelection);
            });
            event.preventDefault();
            return true;
          } else if (possibleNode && possibleNode.getType() !== 'linebreak') {
            possibleNode?.selectStart();
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    kernel.registerHighCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const focusNode = selection.focus.getNode();
          if (
            $isElementNode(focusNode) &&
            focusNode.getChildAtIndex(selection.focus.offset)?.getType() === 'table'
          ) {
            focusNode.getChildAtIndex(selection.focus.offset)?.selectStart();
            event.preventDefault();
            return true;
          }
        } else if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            const node = nodes[0].getNextSibling();
            if ($isRootOrShadowRoot(node)) {
              const parent = node.getParent();
              if (parent) {
                const index = node.getIndexWithinParent();
                parent.select(index, index);
                event.preventDefault();
                return true;
              }
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

const NEEDS_FOLLOWING_PARAGRAPH_TYPES = new Set<string | undefined>([
  'code',
  'table',
  'block-image',
]);

export function registerLastElement(editor: LexicalEditor) {
  let isProcessing = false;

  return editor.registerUpdateListener(({ dirtyElements }) => {
    if (!editor.isEditable()) {
      return;
    }
    // Only process when root node or its direct children have changes
    if (
      !dirtyElements.has('root') &&
      !Array.from(dirtyElements.keys()).some((key) => {
        const node = editor.getEditorState()._nodeMap.get(key);
        return node?.getParent()?.getKey() === 'root';
      })
    ) {
      return;
    }

    if (isProcessing) return;

    const needsParagraph = editor.getEditorState().read(() => {
      const root = $getRoot();
      const lastChild = root.getLastChild();

      // Check if the last element needs a trailing paragraph
      return NEEDS_FOLLOWING_PARAGRAPH_TYPES.has(lastChild?.getType());
    });

    if (needsParagraph) {
      isProcessing = true;

      queueMicrotask(() => {
        editor.update(() => {
          const root = $getRoot();
          const currentLast = root.getLastChild();

          // Double check to ensure the state still needs processing
          if (NEEDS_FOLLOWING_PARAGRAPH_TYPES.has(currentLast?.getType())) {
            const paragraph = $createParagraphNode();
            root.append(paragraph);
          }

          isProcessing = false;
        });
      });
    }
  });
}
