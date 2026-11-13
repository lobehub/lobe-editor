import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, SerializedLexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  DecoratorNode,
  ElementNode,
  HISTORY_MERGE_TAG,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  TextNode,
} from 'lexical';

import { createDebugLogger } from '@/utils/debug';

const logger = createDebugLogger('common', 'cursor');

export class CardLikeElementNode extends ElementNode {
  isCardLike(): boolean {
    return true;
  }
}

export const cursorNodeSerialized = {
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: '\uFEFF',
  type: 'cursor',
  version: 1,
} as SerializedLexicalNode;

export class CursorNode extends TextNode {
  static getType(): string {
    return 'cursor';
  }

  override isUnmergeable(): boolean {
    return true;
  }
}

export function $createCursorNode(): CursorNode {
  return new CursorNode('\uFEFF');
}

export function $isCardLikeElementNode(
  node: LexicalNode | null | undefined,
): node is CardLikeElementNode {
  return node instanceof CardLikeElementNode;
}

export function $isCursorNode(node: LexicalNode | null | undefined): node is CursorNode {
  return node instanceof CursorNode;
}

/**
 * A cursor parked at the very start of the root (offset 0) has no text to
 * anchor to when the first child is a non-inline decorator (block image, HR,
 * ...). The browser then renders a floating caret across the block (the
 * "horizontal cursor" artifact) and typing mutates the wrong position.
 * Normalizing to a leading empty paragraph (a la Linear) gives the caret a
 * real home.
 */
export function $isCaretAtRootStartBeforeBlockDecorator(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const { key, offset, type } = selection.anchor;
  if (key !== 'root') return false;
  if (type === 'text') return false;
  if (offset !== 0) return false;

  const firstChild = $getRoot().getFirstChild();
  return Boolean(firstChild && firstChild.isInline() === false && $isDecoratorNode(firstChild));
}

export function $insertParagraphBeforeRootStartBlock(): void {
  const firstChild = $getRoot().getFirstChild();
  if (!firstChild) return;

  const paragraph = $createParagraphNode();
  firstChild.insertBefore(paragraph);
  paragraph.select(0, 0);
}

export function registerCursorNode(editor: LexicalEditor) {
  let isNormalizingRootStartCaret = false;

  return mergeRegister(
    // Keep a caret parked at root-start (offset 0) in front of a leading
    // non-inline decorator from lingering there: normalize it into a fresh
    // empty paragraph. Runs passively so every selection path (ArrowLeft,
    // ArrowUp from the next block, click on the top gap, NodeSelection +
    // ArrowLeft, ...) lands in a real text anchor.
    editor.registerUpdateListener(() => {
      if (isNormalizingRootStartCaret) return;
      const needsNormalize = editor
        .getEditorState()
        .read(() => (editor.isComposing() ? false : $isCaretAtRootStartBeforeBlockDecorator()));
      if (!needsNormalize) return;

      isNormalizingRootStartCaret = true;
      queueMicrotask(() => {
        isNormalizingRootStartCaret = false;
        // Re-verify against the committed editor state: the caret position
        // that triggered this path may already have been reconciled away.
        const stillNeeded = editor
          .getEditorState()
          .read(() => $isCaretAtRootStartBeforeBlockDecorator());
        if (!stillNeeded) return;

        editor.update(
          () => {
            // The selection itself does not survive DOM reconciliation at
            // this unrepresentable position, so only structural state is
            // re-checked here; the paragraph brings its own fresh selection.
            const firstChild = $getRoot().getFirstChild();
            if (!firstChild || firstChild.isInline() || !$isDecoratorNode(firstChild)) return;

            $insertParagraphBeforeRootStartBlock();
          },
          { tag: HISTORY_MERGE_TAG, discrete: true },
        );
      });
    }),
    editor.registerUpdateListener(({ mutatedNodes }) => {
      editor.getEditorState().read(() => {
        if (!mutatedNodes) return;
        const needAddCursor: Array<LexicalNode> = [];
        for (const [kClass, nodeMaps] of mutatedNodes) {
          // eslint-disable-next-line no-prototype-builtins
          if (DecoratorNode.prototype.isPrototypeOf(kClass.prototype)) {
            for (const [key, mutation] of nodeMaps) {
              const node = $getNodeByKey(key);
              logger.debug('🎭 DecoratorNode mutated:', node?.getType(), mutation, node);
              if (mutation === 'created' && node?.isInline() && node.getNextSibling() === null) {
                needAddCursor.push(node);
              }
            }
          }
        }
        if (needAddCursor.length > 0) {
          editor.update(
            () => {
              needAddCursor.forEach((node) => {
                node.insertAfter($createCursorNode());
              });
            },
            {
              tag: HISTORY_MERGE_TAG,
            },
          );
        }
        return false;
      });
    }),
    editor.registerUpdateListener(({ mutatedNodes }) => {
      editor.getEditorState().read(() => {
        const cursorNodes = mutatedNodes?.get(CursorNode);
        const needRemove = new Set<CursorNode>();
        if (cursorNodes) {
          for (const [key, mutation] of cursorNodes) {
            if (mutation === 'updated') {
              const cursorNode = $getNodeByKey(key);
              if (cursorNode?.getIndexWithinParent() === 0) {
                const nextElement = cursorNode.getNextSibling();
                if (
                  !$isCardLikeElementNode(nextElement) &&
                  !$isDecoratorNode(nextElement) &&
                  !$isCardLikeElementNode(cursorNode?.getParent())
                ) {
                  needRemove.add(cursorNode as CursorNode);
                } else {
                  continue;
                }
              }
              const element = cursorNode?.getPreviousSibling();
              if (
                !$isCardLikeElementNode(element) &&
                !$isDecoratorNode(element) &&
                !$isCardLikeElementNode(cursorNode?.getParent())
              ) {
                needRemove.add(cursorNode as CursorNode);
              }
            }
          }
        }
        if (needRemove.size > 0) {
          editor.update(
            () => {
              needRemove.forEach((node) => {
                node.remove();
              });
            },
            {
              tag: HISTORY_MERGE_TAG,
            },
          );
        }
        return false;
      });
    }),
    editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        const isComposing = editor.isComposing();
        if (isComposing) {
          return false;
        }
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const node = selection.anchor.getNode();
        if (node instanceof CursorNode) {
          if (node.__text !== '\uFEFF') {
            editor.update(
              () => {
                node.setTextContent('\uFEFF');
                const data = node.__text.replace('\uFEFF', '');
                if (data) {
                  const textNode = $createTextNode(data);
                  node.insertAfter(textNode);
                  textNode.selectEnd();
                }
              },
              {
                tag: HISTORY_MERGE_TAG,
              },
            );
          }
          return false;
        }
      });
    }),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const node = selection.anchor.getNode();
        if (node instanceof CursorNode) {
          event.preventDefault();
          const prev = node.getPreviousSibling();
          const parent = node.getParent();
          const parentPrev = parent?.getPreviousSibling();
          let needDispatch = false;
          if ($isDecoratorNode(prev)) {
            prev.selectPrevious();
            node.remove();
            prev.remove();
            event.preventDefault();
            return true;
          } else if (prev) {
            prev.selectEnd();
            needDispatch = true;
          } else if (parent) {
            if (parent.getChildrenSize() === 1) {
              parent.remove();
            } else if (parentPrev) {
              parentPrev.selectEnd();
              needDispatch = true;
            }
          }
          if (needDispatch) {
            queueMicrotask(() => {
              editor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
            });
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        const focusNode = selection.focus.getNode();
        if (!event.shiftKey) {
          if (
            focusNode instanceof CursorNode &&
            !$isCardLikeElementNode(focusNode.getParent()) &&
            !$isCardLikeElementNode(focusNode.getPreviousSibling())
          ) {
            focusNode.selectStart();
          }
          return false;
        }
        const prev = focusNode.getPreviousSibling();
        if (selection.focus.offset === 0 && $isCursorNode(prev)) {
          try {
            const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
            const sel = prev.selectPrevious();
            const { key, offset, type } = sel.anchor;
            sel.anchor.set(anchorKey, anchorOffset, anchorType);
            sel.focus.set(key, offset, type);
            $setSelection(sel);
            return true;
          } catch (error) {
            logger.error('❌ Cursor selection error:', error);
          }
        } else if ($isCursorNode(focusNode)) {
          try {
            const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
            const sel = focusNode.selectPrevious();
            const { key, offset, type } = sel.anchor;
            sel.anchor.set(anchorKey, anchorOffset, anchorType);
            sel.focus.set(key, offset, type);
            $setSelection(sel);
            return true;
          } catch (error) {
            logger.error('❌ Cursor navigation error:', error);
          }
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        if (!event.shiftKey) {
          const focusNode = selection.focus.getNode();
          if (
            focusNode instanceof CursorNode &&
            !$isCardLikeElementNode(focusNode.getParent()) &&
            !$isCardLikeElementNode(focusNode.getPreviousSibling())
          ) {
            focusNode.selectEnd();
          }
          return false;
        }
        const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
        const { key: focusKey, offset: focusOffset, type: focusType } = selection.focus;
        const focusNode = selection.focus.getNode();
        if (
          (focusType === 'text' && focusOffset !== focusNode.getTextContentSize()) ||
          (focusType === 'element' && focusOffset !== (focusNode as ElementNode).getChildrenSize())
        ) {
          return false;
        }
        const sel = focusNode.selectNext();
        if ($isCursorNode(sel.focus.getNode())) {
          sel.focus.getNode().selectNext();
          const { key, offset, type } = sel.anchor;
          sel.anchor.set(anchorKey, anchorOffset, anchorType);
          sel.focus.set(key, offset, type);
          $setSelection(sel);
          return true;
        } else {
          selection.anchor.set(anchorKey, anchorOffset, anchorType);
          selection.focus.set(focusKey, focusOffset, focusType);
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
  );
}
