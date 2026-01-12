import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, HISTORY_MERGE_TAG, LexicalEditor } from 'lexical';

import { $createCursorNode } from '@/plugins/common';
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
      const needAddBefore = new Set<CodeNode>();
      editor.getEditorState().read(() => {
        for (const key of keys) {
          const node = $getNodeByKey(key);
          if (!node) {
            return;
          }
          const parent = node.getParent();
          if (parent?.getFirstChild() === node) {
            needAddBefore.add(node as CodeNode);
          }
        }
      });

      if (needAddBefore.size > 0) {
        editor.update(
          () => {
            needAddBefore.forEach((node) => {
              const prev = node.getPreviousSibling();
              if (!prev) {
                node.insertBefore($createCursorNode());
              }
            });
          },
          {
            tag: HISTORY_MERGE_TAG,
          },
        );
      }
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
