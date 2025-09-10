import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, LexicalEditor } from 'lexical';

import { IEditorKernel } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

import { INSERT_CODEINLINE_COMMAND } from '../command';
import { CodeNode } from '../node/code';

export interface CodeRegistryOptions {
  enableHotkey?: boolean;
}

export function registerCodeInline(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  options?: CodeRegistryOptions,
) {
  const { enableHotkey = true } = options || {};

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
    kernel.registerHotkey(
      HotkeyEnum.CodeInline,
      () => editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopImmediatePropagation: true,
      },
    ),
  );
}
