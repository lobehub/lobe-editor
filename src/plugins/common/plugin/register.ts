import { $isHeadingNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  LexicalEditor,
} from 'lexical';

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
