import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, LexicalEditor } from 'lexical';

import { $createCursorNode } from '@/plugins/common/node/cursor';
import { IEditorKernel } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

import { INSERT_LINK_HIGHLIGHT_COMMAND } from '../command';
import { LinkHighlightNode } from '../node/link-highlight';

export interface LinkHighlightRegistryOptions {
  enableHotkey?: boolean;
}

export function registerLinkHighlight(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  options?: LinkHighlightRegistryOptions,
) {
  const { enableHotkey = true } = options || {};

  return mergeRegister(
    // Update listener to ensure cursor node before first LinkHighlightNode
    editor.registerUpdateListener(({ mutatedNodes }) => {
      const linkHighlightChanged = mutatedNodes?.get(LinkHighlightNode);
      const keys = linkHighlightChanged?.keys() || [];
      const needAddBefore = new Set<LinkHighlightNode>();
      editor.getEditorState().read(() => {
        for (const key of keys) {
          const node = $getNodeByKey(key);
          if (!node) {
            return;
          }
          const parent = node.getParent();
          if (parent?.getFirstChild() === node) {
            needAddBefore.add(node as LinkHighlightNode);
          }
        }
      });

      if (needAddBefore.size > 0) {
        editor.update(() => {
          needAddBefore.forEach((node) => {
            const prev = node.getPreviousSibling();
            if (!prev) {
              node.insertBefore($createCursorNode());
            }
          });
        });
      }
    }),
    // Hotkey for toggling link highlight (Ctrl+K or Cmd+K)
    kernel.registerHotkey(
      HotkeyEnum.Link,
      () => editor.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, undefined),
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopPropagation: true,
      },
    ),
  );
}
