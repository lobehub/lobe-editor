import { mergeRegister } from '@lexical/utils';
import {
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  ElementNode,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  LexicalEditor,
  LexicalNode,
  TextNode,
} from 'lexical';

export class CardLikeElementNode extends ElementNode {
  isCardLike(): boolean {
    return true;
  }
}

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

export function registerCursorNode(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerUpdateListener(({ mutatedNodes }) => {
      console.info('cursor update', mutatedNodes);
      editor.read(() => {
        const cursorNodes = mutatedNodes?.get(CursorNode);
        const needRemove = new Set<CursorNode>();
        if (cursorNodes) {
          for (const [key, mutation] of cursorNodes) {
            if (mutation === 'updated') {
              const cursorNode = $getNodeByKey(key);
              const element = cursorNode?.getPreviousSibling();
              if (
                !$isCardLikeElementNode(element) &&
                !$isCardLikeElementNode(cursorNode?.getParent())
              ) {
                needRemove.add(cursorNode as CursorNode);
              }
            }
          }
        }
        if (needRemove.size > 0) {
          editor.update(() => {
            needRemove.forEach((node) => {
              node.remove();
            });
          });
        }
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const node = selection.anchor.getNode();
        if (node instanceof CursorNode) {
          if (node.__text !== '\uFEFF') {
            editor.update(() => {
              node.setTextContent('\uFEFF');
              const data = node.__text.replace('\uFEFF', '');
              if (data) {
                const textNode = $createTextNode(data);
                node.insertAfter(textNode);
                textNode.selectEnd();
              }
            });
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
          if (prev) {
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
        if (!$isRangeSelection(selection) || !event.shiftKey) {
          return false;
        }
        const focusNode = selection.focus.getNode();
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
            console.error(error);
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
            console.error(error);
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
        if (!$isRangeSelection(selection) || !event.shiftKey) {
          return false;
        }
        const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
        const { key: focusKey, offset: focusOffset, type: focusType } = selection.focus;
        const focusNode = selection.focus.getNode();
        console.info(focusNode, focusOffset, focusType, focusNode.getTextContentSize());
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
