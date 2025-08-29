import {
  $createTextNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createCodeNode } from '../node/code';

export const INSERT_CODEINLINE_COMMAND = createCommand<unknown>('INSERT_CODEINLINE_COMMAND');

export function registerCodeInlineCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_CODEINLINE_COMMAND,
    () => {
      editor.update(() => {
        const codeNode = $createCodeNode();
        const textNode = $createTextNode('');
        codeNode.append(textNode);
        $insertNodes([codeNode]);
        textNode.select();
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );
}
