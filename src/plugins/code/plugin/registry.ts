import { $isCodeHighlightNode } from '@lexical/code';
import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_DOWN_COMMAND,
  LexicalEditor,
  isModifierMatch,
} from 'lexical';

import { CONTROL_OR_META } from '@/common/sys';
import { $createCursorNode } from '@/plugins/common';
import { IEditorKernel } from '@/types';

import { $createCodeNode, $isCodeInlineNode, CodeNode } from '../node/code';

export function registerCodeInline(editor: LexicalEditor, kernel: IEditorKernel) {
  return mergeRegister(
    editor.registerUpdateListener(({ mutatedNodes }) => {
      const codeChanged = mutatedNodes?.get(CodeNode);
      const keys = codeChanged?.keys() || [];
      editor.read(() => {
        for (const key of keys) {
          const node = $getNodeByKey(key);
          if (!node) {
            return;
          }
          const parent = node.getParent();
          if (parent?.__last === key) {
            const codeElement = editor.getElementByKey(key);
            if (!codeElement?.nextSibling) {
              parent
                // @ts-expect-error not error
                .getDOMSlot(editor.getElementByKey(parent.getKey()))
                .setManagedLineBreak('decorator');
            }
          }
        }
      });
    }),
    kernel.registerHighCommand(
      KEY_DOWN_COMMAND,
      (payload) => {
        const selection = $getSelection();
        if (!selection || !$isRangeSelection(selection)) {
          return false;
        }
        const focusNode = selection.focus.getNode();
        const anchorNode = selection.anchor.getNode();
        if ($isCodeHighlightNode(focusNode) || $isCodeHighlightNode(anchorNode)) {
          console.log('code highlight');
          return false;
        }
        if (focusNode.getParent() !== anchorNode.getParent()) {
          console.info('not same parent');
          return false;
        }
        const parentNode = focusNode.getParent();
        console.info('parentNode', parentNode?.getType());
        // ctrl + e
        if (parentNode && isModifierMatch(payload, CONTROL_OR_META) && payload.code === 'KeyE') {
          payload.stopImmediatePropagation();
          payload.preventDefault();
          if ($isCodeInlineNode(parentNode)) {
            for (const node of parentNode.getChildren().slice(0)) {
              parentNode.insertBefore(node);
            }
            parentNode.remove();
            return true;
          } else {
            const codeNode = $createCodeNode(selection.getTextContent());
            $insertNodes([codeNode, $createCursorNode()]);
            codeNode.select();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
