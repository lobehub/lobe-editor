import { $getNodeByKey, $insertNodes, $setSelection, COMMAND_PRIORITY_EDITOR, LexicalEditor, createCommand } from 'lexical';

import { $createCodeMirrorNode } from '../node/CodeMirrorNode';
import { mergeRegister } from '@lexical/utils';

export const INSERT_CODEMIRROR_COMMAND = createCommand<unknown>(
  'INSERT_CODEMIRROR_COMMAND',
);

export const SELECT_BEFORE_CODEMIRROR_COMMAND = createCommand<{ key: string }>(
  'SELECT_BEFORE_CODEMIRROR_COMMAND',
);

export const SELECT_AFTER_CODEMIRROR_COMMAND = createCommand<{ key: string }>(
  'SELECT_AFTER_CODEMIRROR_COMMAND',
);

export function registerCodeMirrorCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_CODEMIRROR_COMMAND,
      () => {
        editor.update(() => {
          const codeMirrorNode = $createCodeMirrorNode('', '');
          $insertNodes([codeMirrorNode]);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      SELECT_BEFORE_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          if (!node) {
            return;
          }
          const prevNode = node.getPreviousSibling();
          const sel = prevNode?.selectEnd();
          console.info('SELECT_BEFORE_CODEMIRROR_COMMAND', prevNode, sel);
          if (sel) {
            $setSelection(sel);
          }
          editor.focus();
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand(
      SELECT_AFTER_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          console.info('SELECT_AFTER_CODEMIRROR_COMMAND', node);
          if (!node) {
            return;
          }
          const nextNode = node.getNextSibling();
          const sel = nextNode?.selectStart();
          if (sel) {
            $setSelection(sel);
          }
          editor.focus();
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    )
  )
}
