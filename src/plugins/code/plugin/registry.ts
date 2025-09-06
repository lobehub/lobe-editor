import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  COMMAND_PRIORITY_EDITOR,
  KEY_DOWN_COMMAND,
  LexicalEditor,
  isModifierMatch,
} from 'lexical';

import { CONTROL_OR_META } from '@/common/sys';
import { IEditorKernel } from '@/types';

import { INSERT_CODEINLINE_COMMAND } from '../command';
import { CodeNode } from '../node/code';

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
        // ctrl + e
        if (isModifierMatch(payload, CONTROL_OR_META) && payload.code === 'KeyE') {
          return editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
