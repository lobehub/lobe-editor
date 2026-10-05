import { $isListItemNode, $isListNode } from '@lexical/list';
import { $isHeadingNode, $isQuoteNode, QuoteNode } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, RangeSelection } from 'lexical';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  REDO_COMMAND,
  RootNode,
  UNDO_COMMAND,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import type { IEditor } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';
import { createDebugLogger } from '@/utils/debug';

import {
  $getAdjacentNode,
  $getDownUpNode,
  $isSelectionAtEndOfRoot,
  $isSelectionInHole,
} from '../node/navigation';
import { shouldHandleNavigationEvent } from '../node/navigation-guards';

export { $getAdjacentNode, $getDownUpNode } from '../node/navigation';

const logger = createDebugLogger('plugin', 'common');

function $isSelectionInList(selection: RangeSelection) {
  return Boolean(
    $closest(selection.focus.getNode(), (node) => $isListNode(node) || $isListItemNode(node)),
  );
}

function $getLeadingQuoteNode(selection: RangeSelection): QuoteNode | false {
  const anchor = selection.anchor;
  if (anchor.offset !== 0) return false;

  let node = anchor.getNode();
  let current: LexicalNode | null = node;
  let quoteNode: QuoteNode | null = null;

  while (current) {
    if ($isQuoteNode(current)) {
      quoteNode = current;
      break;
    }
    current = current.getParent();
  }

  if (!quoteNode) return false;

  while (node !== quoteNode) {
    if (node.getIndexWithinParent() !== 0) return false;
    const parent = node.getParent();
    if (!parent) return false;
    node = parent;
  }

  return quoteNode;
}

function $unwrapQuoteNode(quoteNode: QuoteNode) {
  const children = quoteNode.getChildren();

  if (children.length === 0) {
    const paragraphNode = $createParagraphNode();
    quoteNode.replace(paragraphNode);
    paragraphNode.select(0, 0);
    return;
  }

  let firstNode: LexicalNode | null = null;
  for (const child of children) {
    if ($isElementNode(child)) {
      quoteNode.insertBefore(child);
      firstNode ||= child;
      continue;
    }

    const paragraphNode = $createParagraphNode();
    paragraphNode.append(child);
    quoteNode.insertBefore(paragraphNode);
    firstNode ||= paragraphNode;
  }

  quoteNode.remove();
  if ($isElementNode(firstNode)) firstNode.select(0, 0);
}

export function registerBlockBackspace(editor: LexicalEditor) {
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

      const quoteNode = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        return $getLeadingQuoteNode(selection);
      });

      if (quoteNode) {
        payload.stopImmediatePropagation();
        payload.preventDefault();
        payload.stopPropagation();

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
          const leadingQuoteNode = $getLeadingQuoteNode(selection);
          if (leadingQuoteNode) $unwrapQuoteNode(leadingQuoteNode);
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
          logger.error('❌ Failed to paste as plain text:', error);
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
        if (!shouldHandleNavigationEvent(editor, event, true)) return false;
        const selection = $getSelection();
        if ($isSelectionInHole(selection) && !event.shiftKey) return false;
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
          if ($isSelectionInList(selection)) {
            return false;
          }
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
        if (!shouldHandleNavigationEvent(editor, event, true)) return false;
        const selection = $getSelection();
        if ($isSelectionInHole(selection) && !event.shiftKey) return false;
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
        if (!shouldHandleNavigationEvent(editor, event, true)) return false;
        const selection = $getSelection();
        if ($isSelectionInHole(selection) && !event.shiftKey) return false;
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
          if ($isSelectionInList(selection)) {
            return false;
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
        if (!shouldHandleNavigationEvent(editor, event)) return false;
        const selection = $getSelection();
        if ($isSelectionInHole(selection)) return false;
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
  // Root transforms run inside the originating local editor transaction, so
  // the trailing paragraph is included in the same Yjs update. Remote Yjs
  // projection uses skipTransforms and therefore does not synthesize a second
  // paragraph on every peer.
  return editor.registerNodeTransform(RootNode, (root) => {
    if (!editor.isEditable()) return;
    if (NEEDS_FOLLOWING_PARAGRAPH_TYPES.has(root.getLastChild()?.getType())) {
      root.append($createParagraphNode());
    }
  });
}
