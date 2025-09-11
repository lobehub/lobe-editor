import { $isCodeHighlightNode } from '@lexical/code';
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createCursorNode } from '@/plugins/common';

import { $createCodeNode, $isCodeInlineNode, getCodeInlineNode } from '../node/code';

export const INSERT_CODEINLINE_COMMAND = createCommand<undefined>('INSERT_CODEINLINE_COMMAND');

export function registerCodeInlineCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_CODEINLINE_COMMAND,
    () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!selection || !$isRangeSelection(selection)) {
          return false;
        }
        const focusNode = selection.focus.getNode();
        const anchorNode = selection.anchor.getNode();
        if ($isCodeHighlightNode(focusNode) || $isCodeHighlightNode(anchorNode)) {
          return false;
        }

        const code = getCodeInlineNode(focusNode);

        if (code !== getCodeInlineNode(anchorNode)) {
          return false;
        }

        if ($isCodeInlineNode(code)) {
          for (const node of code.getChildren().slice(0)) {
            code.insertBefore(node);
          }
          code.remove();
          return true;
        }
        const codeNode = $createCodeNode(selection.getTextContent());
        $insertNodes([codeNode, $createCursorNode()]);
        codeNode.select();
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );
}
